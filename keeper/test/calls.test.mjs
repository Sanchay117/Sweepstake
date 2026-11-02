import assert from "node:assert/strict";
import { test } from "node:test";
import { bondExtra, compact, joinPool, unbond, withdrawUnbonded } from "../../shared/calls.mjs";

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

test("compact matches the SCALE reference values", () => {
  assert.equal(hex(compact(0)), "00");
  assert.equal(hex(compact(1)), "04");
  assert.equal(hex(compact(63)), "fc");
  assert.equal(hex(compact(64)), "0101");
  assert.equal(hex(compact(16383)), "fdff");
  assert.equal(hex(compact(16384)), "02000100");
  assert.equal(hex(compact(1073741823)), "feffffff");
  assert.equal(hex(compact(1073741824)), "0300000040");
  assert.equal(hex(compact(10n ** 14n)), "0b00407a10f35a");
});

test("join encodes pallet, call, amount and pool id", () => {
  assert.equal(joinPool(10n ** 14n, 1), "0x3e000b00407a10f35a01000000");
});

test("bondExtra uses a fixed width amount", () => {
  assert.equal(bondExtra(1n), `0x3e010001${"00".repeat(15)}`);
});

test("unbond and withdraw address the member directly", () => {
  const account = `0x${"ab".repeat(32)}`;
  assert.equal(unbond(account, 4), `0x3e0300${"ab".repeat(32)}10`);
  assert.equal(withdrawUnbonded(account), `0x3e0500${"ab".repeat(32)}00000000`);
});
