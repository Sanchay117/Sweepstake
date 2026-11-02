// Adds to the next prize with a plain transfer to the pool's reward account, the same way any
// project could sponsor a draw. Usage: npm run sponsor -- <tPOT>
import "dotenv/config";
import { readFileSync } from "node:fs";
import { connect } from "../lib/chain.mjs";
import { operatorWallet, sendPalletCall } from "../lib/evm.mjs";
import { formatPot, POT } from "../lib/network.mjs";
import { poolAccounts } from "../lib/pool.mjs";

const [amount = "1"] = process.argv.slice(2);
const deployment = JSON.parse(readFileSync(new URL("../../web/src/deployment.json", import.meta.url)));
if (!deployment.vault) throw new Error("Nothing is deployed yet. Run keeper/scripts/setup.mjs first.");

const api = await connect();
const { reward } = poolAccounts(api, deployment.poolIds[0]);
const value = BigInt(amount) * POT;
const receipt = await sendPalletCall(operatorWallet(), api.tx.balances.transferKeepAlive(reward, value));
console.log(`sponsored ${formatPot(value, 0)} tPOT into ${reward}: ${receipt.hash}`);

await api.disconnect();
process.exit(0);
