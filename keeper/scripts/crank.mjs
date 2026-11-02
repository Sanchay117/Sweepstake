// One turn of the keeper. It reads what the chain needs next and does only that, so it is safe to
// rerun at any time. Every step here except the commit could be done by anyone. With --leave-open
// it stops after the commit, so a visitor can finish the draw from the website.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Contract } from "ethers";
import { merkleProof, merkleRoot, ticketFor, winnerIndex } from "../../shared/draw.mjs";
import { DRAW_WINDOW } from "../../shared/vault.mjs";
import { connect, headNumber, waitForBlock } from "../lib/chain.mjs";
import { operatorWallet, rpcMessage, send, sendPalletCall, vaultAbi } from "../lib/evm.mjs";
import { evmToAccountHex, formatPot } from "../lib/network.mjs";
import { poolSnapshot } from "../lib/pool.mjs";

const deployment = JSON.parse(readFileSync(new URL("../../web/src/deployment.json", import.meta.url)));
if (!deployment.vault) throw new Error("Nothing is deployed yet. Run keeper/scripts/setup.mjs first.");

const WEI_PER_PLANCK = 10_000n;
/** Blocks to stay clear of the head. Gas estimates run at the head itself, and the contract wants a past block. */
const ETH_LAG = 3;
const NOTHING_TO_DO =/AlreadyClaimed|NoPendingCommission|InvalidPage|InvalidEraToReward|NotStash/;

const api = await connect();
const wallet = operatorWallet();
const vault = new Contract(deployment.vault, vaultAbi, wallet);
const exclude = [evmToAccountHex(deployment.founder)];

/** Tries a call that may have nothing to do, and treats that as fine. */
async function attempt(name, call) {
  try {
    const receipt = await sendPalletCall(wallet, call);
    console.log(`${name}: ${receipt.hash}`);
  } catch (error) {
    const message = rpcMessage(error);
    if (!NOTHING_TO_DO.test(message)) throw error;
    console.log(`${name}: nothing to do (${message.match(NOTHING_TO_DO)[0]})`);
  }
}

/** Pays out the last finished era if nobody has, then moves the pool's rewards to the vault. */
async function collect() {
  const era = (await api.query.staking.activeEra()).unwrap().index.toNumber() - 1;
  for (const validator of await api.query.session.validators()) {
    await attempt(`payout era ${era}`, api.tx.staking.payoutStakersByPage(validator, era, 0));
  }
  for (const poolId of deployment.poolIds) {
    await attempt(`claim commission, pool ${poolId}`, api.tx.nominationPools.claimCommission(poolId));
  }
}

async function snapshotAt(block) {
  const at = await api.at(await api.rpc.chain.getBlockHash(block));
  return poolSnapshot(at, deployment.poolIds, { exclude });
}

async function commit() {
  const block = (await headNumber(api)) - ETH_LAG;
  const snapshot = await snapshotAt(block);
  if (snapshot.total === 0n) {
    console.log("No members yet, so there is nothing to draw.");
    return false;
  }
  const receipt = await send(wallet, {
    to: deployment.vault,
    data: vaultAbi.encodeFunctionData("commit", [merkleRoot(snapshot), snapshot.total, block]),
  });
  console.log(`committed ${snapshot.entries.length} members at block ${block}: ${receipt.hash}`);
  return true;
}

async function draw() {
  const round = await vault.round();
  const drawBlock = Number(await vault.drawBlock());
  await waitForBlock(api, drawBlock + ETH_LAG);

  const logs = await vault.queryFilter(vault.filters.Committed(round), deployment.firstBlock);
  const { root, totalWeight, snapshotBlock } = logs.at(-1).args;
  const snapshot = await snapshotAt(Number(snapshotBlock));
  if (merkleRoot(snapshot) !== root) throw new Error(`round ${round}: the rebuilt root does not match the commitment`);

  const block = await wallet.provider.send("eth_getBlockByNumber", [`0x${drawBlock.toString(16)}`, false]);
  const ticket = ticketFor({ blockHash: block.hash, root, round, total: totalWeight });
  const index = winnerIndex(snapshot, ticket);
  const entry = snapshot.entries[index];
  const receipt = await send(wallet, {
    to: deployment.vault,
    data: vaultAbi.encodeFunctionData("draw", [entry.address, entry.start, entry.weight, merkleProof(snapshot, index)]),
  });
  console.log(`draw ${round}: ticket ${ticket} went to ${entry.address}: ${receipt.hash}`);
}

await collect();

const prize = (await wallet.provider.getBalance(deployment.vault)) / WEI_PER_PLANCK;
console.log(`prize now ${formatPot(prize)} tPOT`);

const open = Number(await vault.drawBlock());
const head = await headNumber(api);
if (open !== 0 && head <= open + DRAW_WINDOW) {
  await draw();
} else if (prize === 0n) {
  console.log("The prize is empty, so this turn stops here.");
} else if ((await commit()) && !process.argv.includes("--leave-open")) {
  await draw();
}

await api.disconnect();
process.exit(0);
