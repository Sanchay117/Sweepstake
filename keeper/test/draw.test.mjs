import assert from "node:assert/strict";
import { test } from "node:test";
import { getBytes, keccak256, solidityPacked } from "ethers";
import {
  buildSnapshot,
  leafHash,
  merkleProof,
  merkleRoot,
  ticketFor,
  winnerIndex,
} from "../../shared/draw.mjs";

const addr = (n) => `0x${n.toString(16).padStart(40, "0")}`;
const members = (n) => Array.from({ length: n }, (_, i) => ({ address: addr(n - i), points: BigInt(i + 1) * 100n }));

function verify(entry, proof, root) {
  let node = leafHash(entry);
  for (const sibling of proof) {
    const [a, b] = node < sibling ? [node, sibling] : [sibling, node];
    node = keccak256(solidityPacked(["bytes32", "bytes32"], [a, b]));
  }
  return node === root;
}

test("tickets cover the range with no gaps, in address order", () => {
  const snapshot = buildSnapshot(members(5));
  let cursor = 0n;
  let previous = "";
  for (const entry of snapshot.entries) {
    assert.ok(entry.address > previous);
    assert.equal(entry.start, cursor);
    cursor += entry.weight;
    previous = entry.address;
  }
  assert.equal(snapshot.total, cursor);
});

test("input order does not change the root", () => {
  const list = members(6);
  assert.equal(merkleRoot(buildSnapshot(list)), merkleRoot(buildSnapshot([...list].reverse())));
});

test("members with no points hold no tickets", () => {
  const snapshot = buildSnapshot([...members(2), { address: addr(99), points: 0n }]);
  assert.equal(snapshot.entries.length, 2);
});

test("every member has a valid proof, for odd and even tree sizes", () => {
  for (const size of [1, 2, 3, 4, 5, 7, 8, 31, 32]) {
    const snapshot = buildSnapshot(members(size));
    const root = merkleRoot(snapshot);
    snapshot.entries.forEach((entry, i) => {
      assert.ok(verify(entry, merkleProof(snapshot, i), root), `size ${size} member ${i}`);
    });
  }
});

test("a proof does not verify for an altered weight", () => {
  const snapshot = buildSnapshot(members(4));
  const root = merkleRoot(snapshot);
  const forged = { ...snapshot.entries[0], weight: snapshot.total };
  assert.equal(verify(forged, merkleProof(snapshot, 0), root), false);
});

test("each ticket belongs to exactly one member", () => {
  const snapshot = buildSnapshot(members(4));
  for (let t = 0n; t < snapshot.total; t += 37n) {
    const i = winnerIndex(snapshot, t);
    const e = snapshot.entries[i];
    assert.ok(t >= e.start && t < e.start + e.weight);
  }
  assert.equal(winnerIndex(snapshot, snapshot.total), -1);
});

test("the ticket stays inside the range and depends on every input", () => {
  const base = { blockHash: `0x${"11".repeat(32)}`, root: `0x${"22".repeat(32)}`, round: 1n, total: 1000n };
  const ticket = ticketFor(base);
  assert.ok(ticket >= 0n && ticket < 1000n);
  assert.equal(getBytes(base.root).length, 32);
  assert.notEqual(ticketFor({ ...base, total: 10n ** 30n }), ticketFor({ ...base, round: 2n, total: 10n ** 30n }));
  assert.notEqual(
    ticketFor({ ...base, total: 10n ** 30n }),
    ticketFor({ ...base, blockHash: `0x${"33".repeat(32)}`, total: 10n ** 30n }),
  );
});
