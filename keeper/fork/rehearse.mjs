// Rehearses the whole Sweepstake loop on a local fork of the live testnet: deploy, open the pool,
// members join, rewards arrive, a stranger claims the commission, the round is committed and drawn.
// Start the fork first with `npm run fork`. Nothing here touches the real chain.
import { readFileSync } from "node:fs";
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { Interface } from "ethers";
import { merkleProof, merkleRoot, winnerIndex, ticketFor } from "../../shared/draw.mjs";
import { evmToAccountHex, accountToEvm, formatPot, POT, ETH_PER_PLANCK } from "../lib/network.mjs";
import { poolAccounts, poolSnapshot } from "../lib/pool.mjs";
import { u8aToHex } from "@polkadot/util";

const artifact = JSON.parse(readFileSync(new URL("../../contracts/out/PrizeVault.sol/PrizeVault.json", import.meta.url)));
const vaultAbi = new Interface(artifact.abi);

// The fork lazily pulls state from a slow public node, so allow minutes per request.
const provider = new WsProvider("ws://127.0.0.1:8000", 2500, {}, 900_000);
const api = await ApiPromise.create({ provider, noInitWarn: true });
const keyring = new Keyring({ type: "sr25519", ss58Format: 42 });
const names = ["Operator", "Ada", "Ben", "Cleo", "Stranger"];
// Fresh seeds each run, so the same fork can be rehearsed on again.
const run = Date.now();
const bank = keyring.addFromUri(`//Sweepstake/${run}/Bank`);
const people = names.map((n) => keyring.addFromUri(`//Sweepstake/${run}/${n}`));
const [operator, ada, ben, cleo, stranger] = people;

const log = (...args) => console.log(...args);
const check = (ok, label) => {
  log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) process.exitCode = 1;
};

async function send(tx, signer) {
  // Revive bumps a deployer's nonce an extra time, so always take it from chain state.
  const { nonce } = await api.query.system.account(signer.address);
  return new Promise((resolve, reject) => {
    let unsub;
    tx.signAndSend(signer, { nonce }, ({ status, dispatchError, events }) => {
      if (!status.isInBlock && !status.isFinalized) return;
      unsub?.();
      if (dispatchError) {
        if (dispatchError.isModule) {
          const d = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${d.section}.${d.name}`));
        } else reject(new Error(dispatchError.toString()));
      } else resolve(events);
    })
      .then((u) => (unsub = u))
      .catch(reject);
  });
}

const eventsOf = (events, section, method) =>
  events.filter((e) => e.event.section === section && e.event.method === method).map((e) => e.event);

// Write one balance into the fork's state, then pay everyone with real transfers. This chain sets
// AutoMap, so Revive learns a native account when a transfer creates it. mapAccount is a no-op,
// and an account written straight into storage stays unknown to Revive.
await provider.send("dev_setStorage", [
  { System: { Account: [[[bank.address], { providers: 1, data: { free: (1_000_000n * POT).toString() } }]] } },
]);
await send(api.tx.utility.batchAll(people.map((p) => api.tx.balances.transferKeepAlive(p.address, 100_000n * POT))), bank);
log("funded", names.join(", "));
const operatorMapping = await api.query.revive.originalAccount(accountToEvm(u8aToHex(operator.publicKey)));
check(operatorMapping.isSome, "a transfer-created native account is mapped automatically");

const weight = { refTime: 500_000_000_000n, proofSize: 5_000_000n };
const depositLimit = 10_000n * POT;

// 1. Deploy the vault with the operator as keeper.
const keeperEvm = accountToEvm(u8aToHex(operator.publicKey));
const code = artifact.bytecode.object + vaultAbi.encodeDeploy([keeperEvm]).slice(2);
const before = (await api.query.system.account(operator.address)).data.free.toBigInt();
const deployed = await send(api.tx.revive.instantiateWithCode(0, weight, depositLimit, code, "0x", null), operator);
const instantiated = eventsOf(deployed, "revive", "Instantiated")[0];
const vault = instantiated.data.contract.toString();
const after = (await api.query.system.account(operator.address)).data.free.toBigInt();
log("vault", vault, "deploy cost tPOT", formatPot(before - after));
const vaultAccount = evmToAccountHex(vault);

// 2. Open the pool: 100% commission to the vault, claimable by anyone.
const poolId = (await api.query.nominationPools.lastPoolId()).toNumber() + 1;
await send(api.tx.nominationPools.create(20n * POT, operator.address, operator.address, operator.address), operator);
await send(api.tx.nominationPools.setCommission(poolId, [1_000_000_000, vaultAccount]), operator);
await send(api.tx.nominationPools.setCommissionClaimPermission(poolId, "Permissionless"), operator);
const validators = (await api.query.session.validators()).map(String);
await send(api.tx.nominationPools.nominate(poolId, validators), operator);
await send(api.tx.nominationPools.updateRoles(poolId, "Remove", "Noop", "Remove"), operator);
const pool = (await api.query.nominationPools.bondedPools(poolId)).unwrap();
log("pool commission", JSON.stringify(pool.commission.toHuman()));
check(pool.commission.current.isSome, "pool pays 100% commission to the vault");
check(pool.roles.root.isNone && pool.roles.bouncer.isNone, "the pool has no root and no bouncer");
const redirect = await send(api.tx.nominationPools.setCommission(poolId, [1_000_000_000, operator.address]), operator).catch((e) => e);
check(redirect.message === "nominationPools.DoesNotHavePermission", "the operator can no longer redirect the commission");

// 3. Members join with different stakes.
await send(api.tx.nominationPools.join(100n * POT, poolId), ada);
await send(api.tx.nominationPools.join(300n * POT, poolId), ben);
await send(api.tx.nominationPools.join(600n * POT, poolId), cleo);
const member = (await api.query.nominationPools.poolMembers(cleo.address)).unwrap();
check(member.points.toBigInt() === 600n * POT, "Cleo holds 600 tPOT of pool points");

// 4. Staking rewards land in the pool's reward account. A plain transfer has the same effect.
const { reward } = poolAccounts(api, poolId);
await send(api.tx.balances.transferKeepAlive(reward, 5n * POT), stranger);
const vaultBefore = (await api.query.system.account(vaultAccount)).data.free.toBigInt();
await send(api.tx.nominationPools.claimCommission(poolId), stranger);
const vaultAfter = (await api.query.system.account(vaultAccount)).data.free.toBigInt();
log("vault received tPOT", formatPot(vaultAfter - vaultBefore));
check(vaultAfter - vaultBefore === 5n * POT, "a stranger moved all 5 tPOT of rewards into the vault");

// What Solidity sees as its own balance.
const readCall = async (fn, args = []) => {
  const res = await api.call.reviveApi.call(operator.address, vault, 0, weight, null, vaultAbi.encodeFunctionData(fn, args));
  if (res.result.isErr) throw new Error(`dry run ${fn}: ${JSON.stringify(res.result.toHuman())}`);
  const ok = res.result.asOk;
  return { flags: ok.flags.toString(), data: ok.data.toHex() };
};
const prizeEvm = (await api.call.reviveApi.balance(vault)).toString();
log("vault balance as Revive reports it", prizeEvm, "=", formatPot(BigInt(prizeEvm) / ETH_PER_PLANCK), "tPOT");

// 5. Snapshot and commit.
const exclude = [u8aToHex(operator.publicKey)];
const snapshotBlock = (await api.rpc.chain.getHeader()).number.toNumber();
const snapshotAt = async (block) => poolSnapshot(await api.at(await api.rpc.chain.getBlockHash(block)), [poolId], { exclude });
const snapshot = await snapshotAt(snapshotBlock);
const root = merkleRoot(snapshot);
log("members in snapshot", snapshot.entries.length, "total", formatPot(snapshot.total));
check(snapshot.total === 1000n * POT, "snapshot leaves out the operator's founding stake");

// A member who joins after the keeper reads must not break anyone's rebuild of the round.
await send(api.tx.nominationPools.join(50n * POT, poolId), stranger);
check(merkleRoot(await snapshotAt(snapshotBlock)) === root, "the committed snapshot block still rebuilds the same root");

const committed = await send(api.tx.revive.call(vault, 0, weight, depositLimit, vaultAbi.encodeFunctionData("commit", [root, snapshot.total, snapshotBlock])), operator);
log("commit events", committed.map((e) => `${e.event.section}.${e.event.method}`).join(" "));
const drawBlock = BigInt(vaultAbi.decodeFunctionResult("drawBlock", (await readCall("drawBlock")).data)[0]);
const round = BigInt(vaultAbi.decodeFunctionResult("round", (await readCall("round")).data)[0]);
const head = (await api.rpc.chain.getHeader()).number.toBigInt();
log("head", head, "drawBlock", drawBlock, "round", round);

// 6. Wait for the draw block, then read the ticket from the contract and rebuild it off chain.
await provider.send("dev_newBlock", [{ count: Number(drawBlock - head + 2n) }]);
const ticketRead = await readCall("ticket");
log("ticket read flags", ticketRead.flags, ticketRead.data.slice(0, 74));
const ticket = BigInt(vaultAbi.decodeFunctionResult("ticket", ticketRead.data)[0]);
const ethHash = await api.query.revive.blockHash(drawBlock);
log("ticket", ticket, "revive block hash", ethHash.toHex());
const rebuilt = ticketFor({ blockHash: ethHash.toHex(), root, round, total: snapshot.total });
check(rebuilt === ticket, "the ticket rebuilt off chain matches the contract");

// 7. Anyone draws. The winner gets 95%, the keeper 5%.
const index = winnerIndex(snapshot, ticket);
const entry = snapshot.entries[index];
log("winner", entry.address);
const winnerPair = [ada, ben, cleo].find((p) => accountToEvm(u8aToHex(p.publicKey)).toLowerCase() === entry.address);
const winnerBefore = (await api.query.system.account(winnerPair.address)).data.free.toBigInt();
const drawn = await send(
  api.tx.revive.call(vault, 0, weight, depositLimit, vaultAbi.encodeFunctionData("draw", [entry.address, entry.start, entry.weight, merkleProof(snapshot, index)])),
  stranger,
);
const winnerAfter = (await api.query.system.account(winnerPair.address)).data.free.toBigInt();
log("draw events", drawn.map((e) => `${e.event.section}.${e.event.method}`).join(" "));
log("winner received tPOT", formatPot(winnerAfter - winnerBefore));
check(winnerAfter > winnerBefore, "the winner's native account was paid by the Solidity contract");
const vaultLeft = (await api.call.reviveApi.balance(vault)).toString();
log("vault left", vaultLeft);

// 8. Principal is untouched, and a member exits at the pallet with no help from the contract.
const cleoPoints = (await api.query.nominationPools.poolMembers(cleo.address)).unwrap().points.toBigInt();
check(cleoPoints === 600n * POT, "Cleo's principal is unchanged after the draw");
await send(api.tx.nominationPools.unbond(ben.address, 300n * POT), ben);
const benMember = (await api.query.nominationPools.poolMembers(ben.address)).unwrap();
log("Ben unbonding", JSON.stringify(benMember.unbondingEras.toHuman()));
check(benMember.points.toBigInt() === 0n, "Ben left using only the native pallet");
const nextSnapshot = await poolSnapshot(api, [poolId], { exclude });
check(nextSnapshot.total === 750n * POT, "the next snapshot drops an unbonding member and adds the late joiner");

await api.disconnect();
process.exit(process.exitCode ?? 0);
