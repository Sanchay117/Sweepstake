// Reads a nomination pool's members and turns them into draw tickets.
import { u8aToHex } from "@polkadot/util";
import { buildSnapshot } from "../../shared/draw.mjs";
import { accountToEvm } from "./network.mjs";

/** The pool's own native accounts, derived by the pallet, so nobody holds a key for them. */
export function poolAccounts(api, poolId) {
  const palletId = api.consts.nominationPools.palletId;
  const account = (kind) => {
    const bytes = new Uint8Array(32);
    bytes.set(new TextEncoder().encode("modl"), 0);
    bytes.set(palletId.toU8a(), 4);
    bytes[12] = kind;
    new DataView(bytes.buffer).setUint32(13, poolId, true);
    return api.createType("AccountId32", bytes).toString();
  };
  return { bonded: account(0), reward: account(1) };
}

/** Every member with live points, except the operator's founding stake. */
export async function poolMembers(api, poolId, { exclude = [] } = {}) {
  const entries = await api.query.nominationPools.poolMembers.entries();
  const skipped = new Set(exclude.map((id) => id.toLowerCase()));
  const members = [];
  for (const [key, value] of entries) {
    const member = value.unwrap();
    if (member.poolId.toNumber() !== poolId) continue;
    const accountHex = u8aToHex(key.args[0].toU8a());
    if (skipped.has(accountHex)) continue;
    members.push({ account: key.args[0].toString(), address: accountToEvm(accountHex), points: member.points.toBigInt() });
  }
  return members;
}

export async function poolSnapshot(api, poolIds, options) {
  const lists = await Promise.all(poolIds.map((id) => poolMembers(api, id, options)));
  return buildSnapshot(lists.flat());
}
