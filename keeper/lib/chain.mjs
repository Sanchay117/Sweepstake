// Connects to the native side of the chain, and waits out block times.
import { ApiPromise, WsProvider } from "@polkadot/api";
import { NETWORK } from "./network.mjs";

export function connect() {
  // The public node takes close to a minute to serve metadata.
  const provider = new WsProvider(NETWORK.ws, 2500, {}, 300_000);
  return ApiPromise.create({ provider, noInitWarn: true });
}

export const headNumber = async (api) => (await api.rpc.chain.getHeader()).number.toNumber();

export async function waitForBlock(api, target) {
  while ((await headNumber(api)) < target) await new Promise((resolve) => setTimeout(resolve, 3000));
}
