// Leaves one drawable round on the fork after a rehearsal, so the website's open states can be
// exercised with real data. Rewards are simulated with a transfer, as in the rehearsal.
import { readFileSync } from "node:fs";
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { u8aToHex } from "@polkadot/util";
import { Interface } from "ethers";
import { merkleRoot } from "../../shared/draw.mjs";
import { VAULT_ABI } from "../../shared/vault.mjs";
import { POT } from "../lib/network.mjs";
import { poolAccounts, poolSnapshot } from "../lib/pool.mjs";

const { run, vault, poolIds } = JSON.parse(readFileSync(new URL("./deployment.fork.json", import.meta.url)));
const REWARD = BigInt(process.argv[2] ?? 7) * POT;
const vaultAbi = new Interface(VAULT_ABI);
const weight = { refTime: 500_000_000_000n, proofSize: 5_000_000n };

const provider = new WsProvider("ws://127.0.0.1:8000", 2500, {}, 900_000);
const api = await ApiPromise.create({ provider, noInitWarn: true });
const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
const operator = keyring.addFromUri(`//Sweepstake/${run}/Operator`);

async function send(tx) {
  const { nonce } = await api.query.system.account(operator.address);
  return new Promise((resolve, reject) => {
    let unsub;
    tx.signAndSend(operator, { nonce }, ({ status, dispatchError }) => {
      if (!status.isInBlock) return;
      unsub?.();
      if (dispatchError) reject(new Error(dispatchError.toString()));
      else resolve();
    })
      .then((u) => (unsub = u))
      .catch(reject);
  });
}

const { reward } = poolAccounts(api, poolIds[0]);
await send(api.tx.balances.transferKeepAlive(reward, REWARD));
await send(api.tx.nominationPools.claimCommission(poolIds[0]));

const snapshotBlock = (await api.rpc.chain.getHeader()).number.toNumber();
const at = await api.at(await api.rpc.chain.getBlockHash(snapshotBlock));
const snapshot = await poolSnapshot(at, poolIds, { exclude: [u8aToHex(operator.publicKey)] });
const data = vaultAbi.encodeFunctionData("commit", [merkleRoot(snapshot), snapshot.total, snapshotBlock]);
await send(api.tx.revive.call(vault, 0, weight, 10_000n * POT, data));
await provider.send("dev_newBlock", [{ count: 7 }]);

console.log(`round open on ${snapshot.entries.length} members, head ${(await api.rpc.chain.getHeader()).number}`);
await api.disconnect();
process.exit(0);
