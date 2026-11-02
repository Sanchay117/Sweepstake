// The draw, as plain functions. The keeper and the website both run this file, so anyone can
// rebuild a round from public chain state and land on the same winner the contract paid.
import { AbiCoder, keccak256, solidityPacked, solidityPackedKeccak256 } from "ethers";

/** Tickets are pool points, laid end to end in address order so the layout is deterministic. */
export function buildSnapshot(members) {
  const sorted = members
    .filter((m) => BigInt(m.points) > 0n)
    .map((m) => ({ address: m.address.toLowerCase(), points: BigInt(m.points) }))
    .sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));

  let total = 0n;
  const entries = sorted.map((m) => {
    const entry = { address: m.address, start: total, weight: m.points };
    total += m.points;
    return entry;
  });
  return { entries, total };
}

export function leafHash({ address, start, weight }) {
  return solidityPackedKeccak256(["address", "uint128", "uint128"], [address, start, weight]);
}

function hashPair(a, b) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return keccak256(solidityPacked(["bytes32", "bytes32"], [x, y]));
}

/** Pairs are sorted before hashing and an odd node moves up unchanged, as PrizeVault expects. */
export function merkleLevels(leaves) {
  if (leaves.length === 0) throw new Error("no leaves");
  const levels = [leaves];
  while (levels.at(-1).length > 1) {
    const level = levels.at(-1);
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    levels.push(next);
  }
  return levels;
}

export function merkleRoot(snapshot) {
  return merkleLevels(snapshot.entries.map(leafHash)).at(-1)[0];
}

export function merkleProof(snapshot, index) {
  const levels = merkleLevels(snapshot.entries.map(leafHash));
  const proof = [];
  let i = index;
  for (const level of levels.slice(0, -1)) {
    const sibling = i % 2 === 0 ? i + 1 : i - 1;
    if (sibling < level.length) proof.push(level[sibling]);
    i = Math.floor(i / 2);
  }
  return proof;
}

/** The same ticket PrizeVault.ticket() returns for a round. */
export function ticketFor({ blockHash, root, round, total }) {
  const seed = keccak256(
    AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes32", "uint64"], [blockHash, root, round]),
  );
  return BigInt(seed) % BigInt(total);
}

export function winnerIndex(snapshot, ticket) {
  return snapshot.entries.findIndex((e) => ticket >= e.start && ticket < e.start + e.weight);
}
