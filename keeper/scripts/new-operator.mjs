// Creates the operator key in a local, gitignored .env file and prints only its public addresses.
import { existsSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";
import { evmToSs58 } from "../lib/network.mjs";

const path = new URL("../../.env", import.meta.url);
if (existsSync(path)) {
  console.error(".env already exists, so the operator key was left alone.");
  process.exit(1);
}

const wallet = Wallet.createRandom();
writeFileSync(path, `OPERATOR_PRIVATE_KEY=${wallet.privateKey}\n`, { mode: 0o600 });
console.log("EVM address  ", wallet.address);
console.log("Native twin  ", evmToSs58(wallet.address));
