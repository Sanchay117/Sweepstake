// PrizeVault's public face, shared by the keeper and the website.
export const VAULT_ABI = [
  "function keeper() view returns (address)",
  "function root() view returns (bytes32)",
  "function totalWeight() view returns (uint128)",
  "function drawBlock() view returns (uint64)",
  "function round() view returns (uint64)",
  "function ticket() view returns (uint256)",
  "function commit(bytes32 root, uint128 totalWeight, uint64 snapshotBlock)",
  "function draw(address winner, uint128 start, uint128 weight, bytes32[] proof)",
  "event Committed(uint64 indexed round, bytes32 root, uint128 totalWeight, uint64 snapshotBlock, uint64 drawBlock)",
  "event Drawn(uint64 indexed round, address indexed winner, uint256 ticket, uint256 prize, uint256 fee)",
];

/** Blocks after the draw block during which its hash is usable. */
export const DRAW_WINDOW = 200;
