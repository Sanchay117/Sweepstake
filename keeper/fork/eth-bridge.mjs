// Lets the website run against a local fork. Chopsticks has no Ethereum RPC, so this answers the
// eth_ calls the site makes from native state and forwards the rest. shim_send stands in for
// MetaMask: it signs as a test visitor and really executes the call on the fork.
import { createServer } from "node:http";
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { u8aToHex } from "@polkadot/util";
import { accountToEvm, PALLETS_ADDRESS, POT } from "../lib/network.mjs";

const PORT = 8545;
const weight = { refTime: 500_000_000_000n, proofSize: 5_000_000n };
const depositLimit = 10_000n * POT;
const hex = (value) => `0x${BigInt(value).toString(16)}`;

const provider = new WsProvider("ws://127.0.0.1:8000", 2500, {}, 900_000);
const api = await ApiPromise.create({ provider, noInitWarn: true });
const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
const bank = keyring.addFromUri("//SweepstakeBridgeBank");
const visitor = keyring.addFromUri("//SweepstakeBridgeVisitor");

async function execute(tx, signer) {
  const { nonce } = await api.query.system.account(signer.address);
  return new Promise((resolve, reject) => {
    let unsub;
    tx.signAndSend(signer, { nonce }, ({ status, dispatchError }) => {
      if (!status.isInBlock) return;
      unsub?.();
      if (!dispatchError) return resolve(status.asInBlock.toHex());
      const failure = dispatchError.isModule ? api.registry.findMetaError(dispatchError.asModule) : null;
      reject(new Error(failure ? `${failure.section}.${failure.name}` : dispatchError.toString()));
    })
      .then((u) => (unsub = u))
      .catch(reject);
  });
}

// The visitor must exist through a real transfer, because that is what maps it into Revive.
if ((await api.query.system.account(visitor.address)).data.free.isZero()) {
  await provider.send("dev_setStorage", [
    { System: { Account: [[[bank.address], { providers: 1, data: { free: (10_000n * POT).toString() } }]] } },
  ]);
  await execute(api.tx.balances.transferKeepAlive(visitor.address, 5_000n * POT), bank);
}
const visitorAddress = accountToEvm(u8aToHex(visitor.publicKey));

async function logs([{ address, fromBlock }]) {
  const head = (await api.rpc.chain.getHeader()).number.toNumber();
  const found = [];
  for (let number = Number(fromBlock); number <= head; number += 1) {
    const hash = await api.rpc.chain.getBlockHash(number);
    const events = await (await api.at(hash)).query.system.events();
    for (const { event } of events) {
      if (event.section !== "revive" || event.method !== "ContractEmitted") continue;
      if (event.data.contract.toString().toLowerCase() !== address.toLowerCase()) continue;
      found.push({
        address,
        topics: event.data.topics.map((topic) => topic.toHex()),
        data: event.data.data.toHex(),
        blockNumber: hex(number),
        transactionHash: hash.toHex(),
      });
    }
  }
  return found;
}

const handlers = {
  eth_getBalance: async ([address]) => hex((await api.call.reviveApi.balance(address)).toString()),
  eth_getBlockByNumber: async ([number]) => ({ hash: (await api.query.revive.blockHash(Number(number))).toHex() }),
  eth_getLogs: logs,
  eth_gasPrice: async () => "0x1",
  eth_estimateGas: async () => "0x5208",
  eth_getTransactionReceipt: async () => ({ status: "0x1" }),
  shim_visitor: async () => visitorAddress,
  shim_send: async ([{ to, data }]) => {
    const call = to.toLowerCase() === PALLETS_ADDRESS ? api.tx(api.createType("Call", data)) : api.tx.revive.call(to, 0, weight, depositLimit, data);
    return execute(call, visitor);
  },
};

createServer((request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type");
  if (request.method !== "POST") return response.end();
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", async () => {
    const { id, method, params } = JSON.parse(body);
    try {
      const result = await (handlers[method] ? handlers[method](params) : provider.send(method, params));
      response.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    } catch (error) {
      response.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message: error.message } }));
    }
  });
}).listen(PORT, () => console.log(`bridge on http://127.0.0.1:${PORT}, visitor ${visitorAddress}`));
