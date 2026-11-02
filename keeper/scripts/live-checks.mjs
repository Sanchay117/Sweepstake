// Read-only checks against the live testnet, for the facts a fork cannot prove. Sends nothing.
import "dotenv/config";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { u8aToHex } from "@polkadot/util";
import { decodeAddress } from "@polkadot/util-crypto";
import { JsonRpcProvider, Wallet } from "ethers";
import { bondExtra, joinPool } from "../../shared/calls.mjs";
import { accountToEvm, formatPot, NETWORK, PALLETS_ADDRESS, POT } from "../lib/network.mjs";

const provider = new WsProvider(NETWORK.ws, 2500, {}, 300_000);
const api = await ApiPromise.create({ provider, noInitWarn: true });
const evm = new JsonRpcProvider(NETWORK.evmRpc, NETWORK.chainId, { staticNetwork: true });
const log = (...args) => console.log(...args);

// 1. Is the operator funded yet?
const operator = process.env.OPERATOR_PRIVATE_KEY ? new Wallet(process.env.OPERATOR_PRIVATE_KEY).address : null;
if (operator) {
  const balance = (await evm.getBalance(operator)) / 10_000n;
  log(`operator ${operator} holds ${formatPot(balance)} tPOT`);
}

// 2. Does the Ethereum RPC report the same block hash Solidity sees through blockhash()?
const head = (await api.rpc.chain.getHeader()).number.toNumber();
for (const number of [head - 5, head - 100, head - 250]) {
  const stored = (await api.query.revive.blockHash(number)).toHex();
  const block = await evm.send("eth_getBlockByNumber", [`0x${number.toString(16)}`, false]);
  log(`block ${number}: revive ${stored} eth ${block?.hash} ${stored === block?.hash ? "MATCH" : "DIFFERENT"}`);
}

// 3. Does the node keep old state, so a browser can rebuild an old snapshot?
const activeEra = api.query.staking.activeEra.key();
for (const age of [1_000, 10_000, 100_000, head - 1]) {
  const number = head - age;
  try {
    const hash = await provider.send("chain_getBlockHash", [number]);
    const value = await provider.send("state_getStorage", [activeEra, hash]);
    log(`state at block ${number} (${age} old): ${value ? "available" : "empty"}`);
  } catch (error) {
    log(`state at block ${number} (${age} old): refused, ${error.message}`);
  }
}

// 4. Does a wallet's pool call reach the pallet? Pool 1 does not exist yet, so a real dispatch
//    must fail with PoolNotFound. A validator's account is only used as a funded origin here.
const validator = (await api.query.session.validators())[0].toString();
const from = accountToEvm(u8aToHex(decodeAddress(validator)));
for (const [name, data] of [["join", joinPool(POT, 1)], ["bondExtra", bondExtra(POT)]]) {
  try {
    const gas = await evm.send("eth_estimateGas", [{ from, to: PALLETS_ADDRESS, data }]);
    log(`${name} estimate from ${from}: ${BigInt(gas)}`);
  } catch (error) {
    log(`${name} estimate from ${from} failed: ${error.error?.message ?? error.message}`);
  }
}

await api.disconnect();
process.exit(0);
