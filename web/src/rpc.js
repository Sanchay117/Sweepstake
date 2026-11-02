// Reads the chain directly from the browser. There is no backend, so a viewer can check everything.
import { Interface } from "ethers";
import { accountToEvm } from "../../shared/address.mjs";
import { VAULT_ABI } from "../../shared/vault.mjs";

const NODE = "https://test-node-v3.portaldot.dev";
const EVM = "https://test-evm-rpc-v3.portaldot.dev";

const KEYS = {
  poolMembers: "0x7a6d38deaa01cb6e76ee69889f1696273c5f69e270d5b7a07f9996fe9e4e0488",
  activeEra: "0x5f3e4907f716ac89b6347d15ececedca487df464e44a534ba6b0cbb32407b587",
  erasTotalStake: "0x5f3e4907f716ac89b6347d15ececedcaa141c4fe67c2d11f4a10c6aca7a79a04",
  erasValidatorReward: "0x5f3e4907f716ac89b6347d15ececedca7e6ed2ee507c7b4441d59e4ded44b8a2",
};

export const POT = 10n ** 14n;
const WEI_PER_PLANCK = 10_000n;
const ERAS_PER_YEAR = 1460n;
export const ERA_MS = 6 * 60 * 60 * 1000;

export const vaultAbi = new Interface(VAULT_ABI);

let nextId = 1;
async function post(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? "RPC error");
  return body.result;
}

export const node = (method, params = []) => post(NODE, method, params);
export const evm = (method, params = []) => post(EVM, method, params);

const hexBytes = (hex) => Uint8Array.from(hex.slice(2).match(/.{2}/g) ?? [], (b) => Number.parseInt(b, 16));

function littleEndian(bytes, start, length) {
  let value = 0n;
  for (let i = length - 1; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[start + i]);
  return value;
}

export async function readBlock() {
  const header = await node("chain_getHeader");
  return Number.parseInt(header.number, 16);
}

export async function readEra() {
  const raw = await node("state_getStorage", [KEYS.activeEra]);
  const bytes = hexBytes(raw);
  const index = Number(littleEndian(bytes, 0, 4));
  const started = bytes[4] === 1 ? Number(littleEndian(bytes, 5, 8)) : null;
  return { index, endsAt: started ? started + ERA_MS : null };
}

async function pagedKeys(prefix, at) {
  const keys = [];
  for (;;) {
    const page = await node("state_getKeysPaged", [prefix, 500, keys.at(-1) ?? prefix, at ?? null]);
    keys.push(...page);
    if (page.length < 500) return keys;
  }
}

async function storageValues(keys, at) {
  if (keys.length === 0) return [];
  const [change] = await node("state_queryStorageAt", [keys, at ?? null]);
  return change.changes;
}

/** Yearly staking yield, from the last finished era's real payout. */
export async function readApr() {
  const eraOf = (key) => Number(littleEndian(hexBytes(key), hexBytes(key).length - 4, 4));
  const rewards = await pagedKeys(KEYS.erasValidatorReward);
  const latest = rewards.reduce((best, key) => (eraOf(key) > eraOf(best) ? key : best));
  const suffix = latest.slice(KEYS.erasValidatorReward.length);
  const [reward, stake] = await Promise.all([
    node("state_getStorage", [latest]),
    node("state_getStorage", [KEYS.erasTotalStake + suffix]),
  ]);
  const paid = littleEndian(hexBytes(reward), 0, 16);
  const staked = littleEndian(hexBytes(stake), 0, 16);
  return Number((paid * ERAS_PER_YEAR * 10_000n) / staked) / 100;
}

/** Every pool member, decoded from raw storage: pool id at byte 0, points at byte 4. */
export async function readMembers(poolIds, { at, exclude = [] } = {}) {
  const skip = new Set(exclude.map((a) => a.toLowerCase()));
  const keys = await pagedKeys(KEYS.poolMembers, at);
  const values = await storageValues(keys, at);
  const members = [];
  for (const [key, value] of values) {
    if (!value) continue;
    const accountHex = `0x${key.slice(-64)}`;
    const bytes = hexBytes(value);
    const poolId = Number(littleEndian(bytes, 0, 4));
    const address = accountToEvm(accountHex);
    if (poolIds.includes(poolId) && !skip.has(address.toLowerCase())) {
      members.push({ accountHex, address, poolId, points: littleEndian(bytes, 4, 16) });
    }
  }
  return members;
}

export async function readPrize(vault) {
  return BigInt(await evm("eth_getBalance", [vault, "latest"])) / WEI_PER_PLANCK;
}

export async function readBalance(address) {
  return BigInt(await evm("eth_getBalance", [address, "latest"])) / WEI_PER_PLANCK;
}

/** Every round the contract has logged, newest first. */
export async function readRounds(vault, firstBlock) {
  const logs = await evm("eth_getLogs", [{ address: vault, fromBlock: `0x${firstBlock.toString(16)}`, toBlock: "latest" }]);
  const rounds = new Map();
  for (const log of logs) {
    const parsed = vaultAbi.parseLog(log);
    if (!parsed) continue;
    const id = Number(parsed.args.round);
    const round = rounds.get(id) ?? { id };
    const block = Number.parseInt(log.blockNumber, 16);
    if (parsed.name === "Committed") {
      Object.assign(round, {
        root: parsed.args.root,
        total: parsed.args.totalWeight,
        snapshotBlock: Number(parsed.args.snapshotBlock),
        drawBlock: Number(parsed.args.drawBlock),
      });
    } else {
      Object.assign(round, {
        winner: parsed.args.winner,
        ticket: parsed.args.ticket,
        prize: parsed.args.prize / WEI_PER_PLANCK,
        fee: parsed.args.fee / WEI_PER_PLANCK,
        paidBlock: block,
        tx: log.transactionHash,
      });
    }
    rounds.set(id, round);
  }
  return [...rounds.values()].sort((a, b) => b.id - a.id);
}

export async function blockHashes(number) {
  const [substrate, ethereum] = await Promise.all([
    node("chain_getBlockHash", [number]),
    evm("eth_getBlockByNumber", [`0x${number.toString(16)}`, false]),
  ]);
  return { substrate, ethereum: ethereum?.hash };
}

export function formatPot(planck, digits = 2) {
  const value = BigInt(planck);
  const whole = (value / POT).toLocaleString("en-US");
  if (digits === 0) return whole;
  const fraction = (value % POT).toString().padStart(14, "0").slice(0, digits);
  return `${whole}.${fraction}`;
}
