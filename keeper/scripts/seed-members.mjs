// Bonds test members through the same call a MetaMask user signs. Their keys derive from the
// operator's, so no new secrets exist. Usage: npm run seed-members -- <count> <tPOT each>
import "dotenv/config";
import { readFileSync } from "node:fs";
import { getBytes, keccak256, parseEther, Wallet } from "ethers";
import { joinPool } from "../../shared/calls.mjs";
import { evmProvider, operatorWallet, send, rpcMessage } from "../lib/evm.mjs";
import { formatPot, PALLETS_ADDRESS, POT } from "../lib/network.mjs";

const [count = "3", amount = "100"] = process.argv.slice(2);
const deployment = JSON.parse(readFileSync(new URL("../../web/src/deployment.json", import.meta.url)));
if (!deployment.vault) throw new Error("Nothing is deployed yet. Run keeper/scripts/setup.mjs first.");

const GAS_MONEY = 5n;
const operator = operatorWallet();

for (let i = 0; i < Number(count); i += 1) {
  const key = keccak256(getBytes(`${operator.privateKey}${(i + 1).toString(16).padStart(2, "0")}`));
  const member = new Wallet(key, evmProvider());
  const bond = BigInt(amount) * POT;

  const funded = await send(operator, { to: member.address, value: parseEther((BigInt(amount) + GAS_MONEY).toString()) });
  console.log(`member ${i + 1} ${member.address} funded: ${funded.hash}`);

  try {
    const joined = await send(member, { to: PALLETS_ADDRESS, data: joinPool(bond, deployment.poolIds[0]) });
    console.log(`member ${i + 1} bonded ${formatPot(bond, 0)} tPOT: ${joined.hash}`);
  } catch (error) {
    console.log(`member ${i + 1} could not bond: ${rpcMessage(error)}`);
  }
}

process.exit(0);
