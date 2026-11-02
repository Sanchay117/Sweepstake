// SCALE encoders for the runtime calls a MetaMask user needs. An Ethereum transaction sent to the
// runtime pallets address carries one of these as its data, and Portaldot V3 dispatches it as a
// native call signed by the sender's twin account. Indices are from runtime spec 3002.
const POOLS = 62;
const CALL = { join: 0, bondExtra: 1, unbond: 3, withdrawUnbonded: 5 };

const bytesToHex = (bytes) => `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
const hexToBytes = (hex) => {
  const clean = hex.replace(/^0x/, "");
  return Uint8Array.from(clean.match(/.{2}/g) ?? [], (b) => Number.parseInt(b, 16));
};

function littleEndian(value, length) {
  const out = new Uint8Array(length);
  let rest = BigInt(value);
  for (let i = 0; i < length; i += 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

export function compact(value) {
  const n = BigInt(value);
  if (n < 1n << 6n) return Uint8Array.of(Number(n << 2n));
  if (n < 1n << 14n) return littleEndian((n << 2n) | 1n, 2);
  if (n < 1n << 30n) return littleEndian((n << 2n) | 2n, 4);
  const size = Math.ceil(n.toString(16).length / 2);
  return Uint8Array.of(((size - 4) << 2) | 3, ...littleEndian(n, size));
}

const encode = (call, ...parts) => bytesToHex(Uint8Array.of(POOLS, call, ...parts.flatMap((p) => [...p])));

/** MultiAddress::Id for a 32-byte native account. */
const accountId = (accountHex) => Uint8Array.of(0, ...hexToBytes(accountHex));

export const joinPool = (amount, poolId) => encode(CALL.join, compact(amount), littleEndian(poolId, 4));

/** Adds to an existing position, drawn from free balance. */
export const bondExtra = (amount) => encode(CALL.bondExtra, Uint8Array.of(0), littleEndian(amount, 16));

export const unbond = (accountHex, points) => encode(CALL.unbond, accountId(accountHex), compact(points));

export const withdrawUnbonded = (accountHex, slashingSpans = 0) =>
  encode(CALL.withdrawUnbonded, accountId(accountHex), littleEndian(slashingSpans, 4));
