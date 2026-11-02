// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title PrizeVault
/// @notice The only contract in Sweepstake. It never holds a deposit: members' POT stays bonded in
///         a native nomination pool. That pool pays 100% commission to this address, so whatever
///         sits here is the prize, and the worst a bug in this file can lose is one prize.
/// @dev Pallets cannot be read from Solidity, so the keeper commits a Merkle root of the pool's
///      members before the draw block exists. Anyone can rebuild that root from chain state.
///      A round uses fixed slots and history lives in events, because each new storage slot
///      locks a deposit on Portaldot V3.
contract PrizeVault {
    uint256 internal constant DELAY = 5; // blocks from commit to the draw block
    uint256 internal constant WINDOW = 200; // blocks the draw block's hash stays usable
    uint256 internal constant FEE_BPS = 500; // 5% of each prize, paid to the keeper

    address public immutable keeper;

    bytes32 public root;
    uint128 public totalWeight;
    uint64 public drawBlock;
    uint64 public round;

    event Committed(uint64 indexed round, bytes32 root, uint128 totalWeight, uint64 drawBlock);
    event Drawn(uint64 indexed round, address indexed winner, uint256 ticket, uint256 prize, uint256 fee);

    error NotKeeper();
    error RoundOpen();
    error EmptyRound();
    error NotDrawable();
    error NotWinner();
    error BadProof();
    error PayFailed();

    constructor(address keeper_) {
        keeper = keeper_;
    }

    /// @notice Tops up the prize. Pool commission arrives as a native transfer and skips this.
    receive() external payable {}

    /// @notice Locks in the member snapshot, then waits for a block hash nobody can know yet.
    /// @dev A round nobody drew inside the window can be replaced, so a lost hash never stalls.
    function commit(bytes32 root_, uint128 totalWeight_) external {
        if (msg.sender != keeper) revert NotKeeper();
        if (totalWeight_ == 0) revert EmptyRound();
        uint256 open = drawBlock;
        if (open != 0 && block.number <= open + WINDOW) revert RoundOpen();

        uint64 next = uint64(block.number + DELAY);
        root = root_;
        totalWeight = totalWeight_;
        drawBlock = next;
        emit Committed(++round, root_, totalWeight_, next);
    }

    /// @notice The ticket this round landed on, once the draw block's hash exists.
    function ticket() public view returns (uint256) {
        uint256 at = drawBlock;
        if (at == 0 || block.number <= at || block.number > at + WINDOW) revert NotDrawable();
        bytes32 hash = blockhash(at);
        if (hash == 0) revert NotDrawable();
        return uint256(keccak256(abi.encode(hash, root, round))) % totalWeight;
    }

    /// @notice Pays the member whose interval holds the ticket. Anyone can call it for the winner.
    /// @param start First ticket of the member's interval.
    /// @param weight Tickets the member holds, equal to their pool points.
    /// @param proof Sibling hashes from the member's leaf up to the root.
    function draw(address winner, uint128 start, uint128 weight, bytes32[] calldata proof) external {
        uint256 won = ticket();
        if (won < start || won >= uint256(start) + weight) revert NotWinner();

        bytes32 node = keccak256(abi.encodePacked(winner, start, weight));
        for (uint256 i; i < proof.length; ++i) {
            bytes32 sibling = proof[i];
            node = node < sibling
                ? keccak256(abi.encodePacked(node, sibling))
                : keccak256(abi.encodePacked(sibling, node));
        }
        if (node != root) revert BadProof();

        drawBlock = 0;
        uint256 prize = address(this).balance;
        uint256 fee = prize * FEE_BPS / 10_000;
        emit Drawn(round, winner, won, prize - fee, fee);

        (bool paid,) = winner.call{value: prize - fee}("");
        (bool feePaid,) = keeper.call{value: fee}("");
        if (!paid || !feePaid) revert PayFailed();
    }
}
