// Stands in for MetaMask while the film is shot on the live chain. The website's transactions are
// real, signed by a test wallet whose key derives from the operator's, so no new secrets exist.
// Usage: npm run film-wallet -- <wallet number> <tPOT to hold>
import "dotenv/config";
import { createServer } from "node:http";
import { getBytes, keccak256, parseEther, Wallet } from "ethers";
import { evmProvider, operatorWallet, send } from "../lib/evm.mjs";
import { NETWORK } from "../lib/network.mjs";

const PORT = 8545;
const [number = "4", amount = "20"] = process.argv.slice(2);

const operator = operatorWallet();
const key = keccak256(getBytes(`${operator.privateKey}${Number(number).toString(16).padStart(2, "0")}`));
const visitor = new Wallet(key, evmProvider());

const held = await visitor.provider.getBalance(visitor.address);
if (held < parseEther(amount)) {
  const funded = await send(operator, { to: visitor.address, value: parseEther(amount) - held });
  console.log(`funded: ${funded.hash}`);
}

const handlers = {
  shim_visitor: async () => visitor.address,
  shim_send: async ([{ to, data, gas, gasPrice }]) => {
    const sent = await visitor.sendTransaction({ to, data, gasLimit: gas, gasPrice, type: 0, chainId: NETWORK.chainId });
    console.log(`sent: ${sent.hash}`);
    return sent.hash;
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
      response.end(JSON.stringify({ jsonrpc: "2.0", id, result: await handlers[method](params) }));
    } catch (error) {
      response.end(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32000, message: error.message } }));
    }
  });
}).listen(PORT, () => console.log(`film wallet on http://127.0.0.1:${PORT}, visitor ${visitor.address}`));
