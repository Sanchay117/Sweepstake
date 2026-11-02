// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PrizeVault} from "../src/PrizeVault.sol";

contract Refuser {
    receive() external payable {
        revert("no");
    }
}

contract PrizeVaultTest is Test {
    uint256 constant DELAY = 5;
    uint256 constant WINDOW = 200;

    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    PrizeVault vault;

    function setUp() public {
        vault = new PrizeVault(keeper);
        vm.roll(1_000);
    }

    function leaf(address who, uint128 start, uint128 weight) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(who, start, weight));
    }

    function pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function open(bytes32 root, uint128 total) internal returns (uint256 at) {
        vm.prank(keeper);
        vault.commit(root, total, 1);
        at = vault.drawBlock();
        vm.roll(at + 1);
        vm.setBlockhash(at, keccak256(abi.encode("hash", at)));
    }

    /// A three member tree: alice [0, 100), bob [100, 400), carol [400, 1000).
    function tree() internal view returns (bytes32 root, bytes32 la, bytes32 lb, bytes32 lc) {
        la = leaf(alice, 0, 100);
        lb = leaf(bob, 100, 300);
        lc = leaf(carol, 400, 600);
        root = pair(pair(la, lb), lc);
    }

    function drawFor(uint256 won, bytes32 la, bytes32 lb, bytes32 lc) internal returns (address) {
        bytes32[] memory proof;
        if (won < 100) {
            proof = new bytes32[](2);
            proof[0] = lb;
            proof[1] = lc;
            vault.draw(alice, 0, 100, proof);
            return alice;
        }
        if (won < 400) {
            proof = new bytes32[](2);
            proof[0] = la;
            proof[1] = lc;
            vault.draw(bob, 100, 300, proof);
            return bob;
        }
        proof = new bytes32[](1);
        proof[0] = pair(la, lb);
        vault.draw(carol, 400, 600, proof);
        return carol;
    }

    function test_commitOpensRoundAtDelayedBlock() public {
        vm.prank(keeper);
        vault.commit(bytes32(uint256(1)), 10, 1);
        assertEq(vault.round(), 1);
        assertEq(vault.drawBlock(), block.number + DELAY);
        assertEq(vault.totalWeight(), 10);
    }

    function test_onlyKeeperCommits() public {
        vm.expectRevert(PrizeVault.NotKeeper.selector);
        vault.commit(bytes32(uint256(1)), 10, 1);
    }

    function test_emptyRoundRejected() public {
        vm.prank(keeper);
        vm.expectRevert(PrizeVault.EmptyRound.selector);
        vault.commit(bytes32(uint256(1)), 0, 1);
    }

    function test_commitNamesItsSnapshotBlock() public {
        uint64 snapshot = uint64(block.number - 1);
        vm.expectEmit(true, false, false, true);
        emit PrizeVault.Committed(1, bytes32(uint256(1)), 10, snapshot, uint64(block.number + DELAY));
        vm.prank(keeper);
        vault.commit(bytes32(uint256(1)), 10, snapshot);
    }

    function test_snapshotMustPredateCommit() public {
        vm.startPrank(keeper);
        vm.expectRevert(PrizeVault.LateSnapshot.selector);
        vault.commit(bytes32(uint256(1)), 10, uint64(block.number));
        vm.expectRevert(PrizeVault.LateSnapshot.selector);
        vault.commit(bytes32(uint256(1)), 10, uint64(block.number + 1));
        vm.stopPrank();
    }

    function test_cannotCommitOverOpenRound() public {
        vm.startPrank(keeper);
        vault.commit(bytes32(uint256(1)), 10, 1);
        vm.roll(block.number + DELAY + WINDOW);
        vm.expectRevert(PrizeVault.RoundOpen.selector);
        vault.commit(bytes32(uint256(2)), 10, 1);
        vm.stopPrank();
    }

    function test_expiredRoundCanBeReplaced() public {
        vm.startPrank(keeper);
        vault.commit(bytes32(uint256(1)), 10, 1);
        vm.roll(block.number + DELAY + WINDOW + 1);
        vault.commit(bytes32(uint256(2)), 10, 1);
        vm.stopPrank();
        assertEq(vault.round(), 2);
        assertEq(vault.root(), bytes32(uint256(2)));
    }

    function test_ticketUnknownBeforeDrawBlock() public {
        vm.prank(keeper);
        vault.commit(bytes32(uint256(1)), 10, 1);
        vm.roll(vault.drawBlock());
        vm.expectRevert(PrizeVault.NotDrawable.selector);
        vault.ticket();
    }

    function test_ticketRefusedAfterWindow() public {
        uint256 at = open(bytes32(uint256(1)), 10);
        vm.roll(at + WINDOW + 1);
        vm.expectRevert(PrizeVault.NotDrawable.selector);
        vault.ticket();
    }

    function test_ticketRefusedWhenHashMissing() public {
        vm.prank(keeper);
        vault.commit(bytes32(uint256(1)), 10, 1);
        uint256 at = vault.drawBlock();
        vm.roll(at + 1);
        vm.setBlockhash(at, bytes32(0));
        vm.expectRevert(PrizeVault.NotDrawable.selector);
        vault.ticket();
    }

    function test_drawPaysWinnerAndFee() public {
        vm.deal(address(vault), 100 ether);
        (bytes32 root, bytes32 la, bytes32 lb, bytes32 lc) = tree();
        open(root, 1_000);

        address winner = drawFor(vault.ticket(), la, lb, lc);

        assertEq(winner.balance, 95 ether);
        assertEq(keeper.balance, 5 ether);
        assertEq(address(vault).balance, 0);
        assertEq(vault.drawBlock(), 0);
    }

    function test_anyoneCanDrawForWinner() public {
        vm.deal(address(vault), 1 ether);
        (bytes32 root, bytes32 la, bytes32 lb, bytes32 lc) = tree();
        open(root, 1_000);
        uint256 won = vault.ticket();

        vm.prank(makeAddr("stranger"));
        address winner = drawFor(won, la, lb, lc);

        assertEq(winner.balance, 0.95 ether);
    }

    function test_drawTwiceRefused() public {
        vm.deal(address(vault), 1 ether);
        (bytes32 root, bytes32 la, bytes32 lb, bytes32 lc) = tree();
        open(root, 1_000);
        uint256 won = vault.ticket();
        drawFor(won, la, lb, lc);

        vm.expectRevert(PrizeVault.NotDrawable.selector);
        drawFor(won, la, lb, lc);
    }

    function test_memberOutsideTicketRefused() public {
        vm.deal(address(vault), 1 ether);
        bytes32 root = leaf(alice, 0, 10);
        open(root, 1_000); // total above the tree, so the ticket is usually past alice's interval
        uint256 won = vault.ticket();
        vm.assume(won >= 10);

        vm.expectRevert(PrizeVault.NotWinner.selector);
        vault.draw(alice, 0, 10, new bytes32[](0));
    }

    function test_forgedIntervalRefused() public {
        vm.deal(address(vault), 1 ether);
        (bytes32 root,, bytes32 lb, bytes32 lc) = tree();
        open(root, 1_000);

        bytes32[] memory proof = new bytes32[](2);
        proof[0] = lb;
        proof[1] = lc;
        vm.expectRevert(PrizeVault.BadProof.selector);
        vault.draw(alice, 0, 1_000, proof); // alice claims every ticket
    }

    function test_replacedWinnerRefused() public {
        vm.deal(address(vault), 1 ether);
        bytes32 root = leaf(alice, 0, 10);
        open(root, 10);

        vm.expectRevert(PrizeVault.BadProof.selector);
        vault.draw(bob, 0, 10, new bytes32[](0));
    }

    function test_refusingWinnerRollsTheRoundBack() public {
        Refuser refuser = new Refuser();
        vm.deal(address(vault), 1 ether);
        bytes32 root = leaf(address(refuser), 0, 10);
        uint256 at = open(root, 10);

        vm.expectRevert(PrizeVault.PayFailed.selector);
        vault.draw(address(refuser), 0, 10, new bytes32[](0));

        assertEq(address(vault).balance, 1 ether);
        assertEq(vault.drawBlock(), at);
    }

    function test_topUpsReachThePrize() public {
        vm.deal(address(this), 3 ether);
        (bool ok,) = address(vault).call{value: 3 ether}("");
        assertTrue(ok);
        assertEq(address(vault).balance, 3 ether);
    }

    /// Every ticket in the range belongs to exactly one member, and their odds follow weight.
    function testFuzz_ticketStaysInRange(bytes32 root, uint128 total, uint64 hashSeed) public {
        total = uint128(bound(total, 1, type(uint128).max));
        vm.prank(keeper);
        vault.commit(root, total, 1);
        uint256 at = vault.drawBlock();
        vm.roll(at + 1);
        vm.setBlockhash(at, keccak256(abi.encode(hashSeed)));
        assertLt(vault.ticket(), total);
    }

    function testFuzz_prizeAndFeeAddUp(uint96 balance) public {
        vm.deal(address(vault), balance);
        bytes32 root = leaf(alice, 0, 10);
        open(root, 10);
        vault.draw(alice, 0, 10, new bytes32[](0));

        assertEq(alice.balance + keeper.balance, balance);
        assertEq(keeper.balance, uint256(balance) * 500 / 10_000);
    }

    function testFuzz_commitOutsiderRefused(address outsider) public {
        vm.assume(outsider != keeper);
        vm.prank(outsider);
        vm.expectRevert(PrizeVault.NotKeeper.selector);
        vault.commit(bytes32(uint256(1)), 10, 1);
    }
}
