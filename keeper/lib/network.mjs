// Facts about the Portaldot V3 testnet, read from the live runtime (spec 3002).
import { encodeAddress } from "@polkadot/util-crypto";
import { evmToAccountHex } from "../../shared/address.mjs";

export { accountToEvm, evmToAccountHex } from "../../shared/address.mjs";

export const NETWORK = {
  ws: process.env.SWEEPSTAKE_WS ?? "wss://test-node-v3.portaldot.dev",
  evmRpc: process.env.SWEEPSTAKE_EVM_RPC ?? "https://test-evm-rpc-v3.portaldot.dev",
  chainId: 420420777,
  ss58: 42,
  decimals: 14,
};

export const POT = 10n ** 14n;
export const ETH_PER_PLANCK = 10_000n; // Revive.NativeToEthRatio
export const PALLETS_ADDRESS = "0x6d6f646c70792f70616464720000000000000000";

export function evmToSs58(address) {
  return encodeAddress(evmToAccountHex(address), NETWORK.ss58);
}

export const formatPot = (planck, digits = 4) => {
  const value = BigInt(planck);
  const whole = value / POT;
  const fraction = (value % POT).toString().padStart(14, "0").slice(0, digits);
  return digits === 0 ? `${whole}` : `${whole}.${fraction}`;
};
