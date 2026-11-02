// Everything the operator does goes through one Ethereum key, including the native pallet calls.
import { readFileSync } from "node:fs";
import { Interface, JsonRpcProvider, Wallet } from "ethers";
import { VAULT_ABI } from "../../shared/vault.mjs";
import { NETWORK, PALLETS_ADDRESS } from "./network.mjs";

export const vaultAbi = new Interface(VAULT_ABI);

/** The compiled contract. Only deployment needs it, so the keeper can run without Foundry. */
export const loadArtifact = () =>
  JSON.parse(readFileSync(new URL("../../contracts/out/PrizeVault.sol/PrizeVault.json", import.meta.url)));

export const evmProvider = () => new JsonRpcProvider(NETWORK.evmRpc, NETWORK.chainId, { staticNetwork: true });

export function operatorWallet() {
  const key = process.env.OPERATOR_PRIVATE_KEY;
  if (!key) throw new Error("OPERATOR_PRIVATE_KEY is not set. Run keeper/scripts/new-operator.mjs first.");
  return new Wallet(key, evmProvider());
}

/** The node's own words, which ethers files away when it cannot parse a failure. */
export const rpcMessage = (error) => error?.info?.error?.message ?? error?.shortMessage ?? error?.message ?? String(error);

/** Sends with the node's own estimate. The chain prices deposits into gas, so a fixed limit fails. */
export async function send(wallet, tx) {
  const { provider } = wallet;
  const [gasLimit, gasPrice, nonce] = await Promise.all([
    provider.estimateGas({ ...tx, from: wallet.address }),
    provider.send("eth_gasPrice", []),
    provider.getTransactionCount(wallet.address, "pending"),
  ]);
  const sent = await wallet.sendTransaction({ ...tx, gasLimit, gasPrice, nonce, type: 0, chainId: NETWORK.chainId });
  const receipt = await sent.wait();
  if (receipt.status !== 1) throw new Error(`transaction reverted: ${sent.hash}`);
  return receipt;
}

/** Dispatches a SCALE-encoded runtime call from the wallet's twin account. */
export const sendPalletCall = (wallet, call) => send(wallet, { to: PALLETS_ADDRESS, data: call.method.toHex() });
