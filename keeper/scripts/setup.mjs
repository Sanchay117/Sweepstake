// Opens Sweepstake on the live testnet: deploys PrizeVault, opens the pool that pays it, then gives
// up the pool's root role so nobody can redirect the commission. Run it once, with a funded operator.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { Interface } from "ethers";
import { connect, headNumber } from "../lib/chain.mjs";
import { loadArtifact, operatorWallet, send, sendPalletCall } from "../lib/evm.mjs";
import { evmToAccountHex, evmToSs58, formatPot, POT } from "../lib/network.mjs";

const DEPLOYMENT = new URL("../../web/src/deployment.json", import.meta.url);
const SCANNER = "https://scanner-testnet-v3.portaldot.dev/#";
const FULL_COMMISSION = 1_000_000_000; // Perbill
const FOUNDING_BOND = 20n * POT;

const deployment = JSON.parse(readFileSync(DEPLOYMENT));
if (deployment.vault) throw new Error(`Already deployed at ${deployment.vault}. Clear web/src/deployment.json to start over.`);

const api = await connect();
const wallet = operatorWallet();
const twin = evmToSs58(wallet.address);
const balance = (await wallet.provider.getBalance(wallet.address)) / 10_000n;
console.log(`operator ${wallet.address}, native ${twin}, holds ${formatPot(balance)} tPOT`);

const links = [];
const note = (name, receipt) => {
  console.log(`${name}: ${receipt.hash} in block ${receipt.blockNumber}`);
  links.push([name, `Block ${receipt.blockNumber}`, `/blocks/${receipt.blockNumber}?tab=events`]);
  return receipt;
};

// 1. The vault, with the operator as keeper.
const firstBlock = await headNumber(api);
const artifact = loadArtifact();
const code = artifact.bytecode.object + new Interface(artifact.abi).encodeDeploy([wallet.address]).slice(2);
const deployed = note("Contract deployed", await send(wallet, { data: code }));
const vault = deployed.contractAddress;
console.log(`vault ${vault}`);

// 2. The pool: 100% commission to the vault, claimable by anyone. The operator keeps only the
//    nominator role, which picks validators and cannot touch funds.
const poolId = (await api.query.nominationPools.lastPoolId()).toNumber() + 1;
const pools = api.tx.nominationPools;
note("Pool opened", await sendPalletCall(wallet, pools.create(FOUNDING_BOND, twin, twin, twin)));
note("Commission set to 100%", await sendPalletCall(wallet, pools.setCommission(poolId, [FULL_COMMISSION, evmToAccountHex(vault)])));
note("Commission claim opened to anyone", await sendPalletCall(wallet, pools.setCommissionClaimPermission(poolId, "Permissionless")));
const validators = (await api.query.session.validators()).map(String);
note("Pool nominated", await sendPalletCall(wallet, pools.nominate(poolId, validators)));
note("Root role renounced", await sendPalletCall(wallet, pools.updateRoles(poolId, "Remove", "Noop", "Remove")));

const roles = (await api.query.nominationPools.bondedPools(poolId)).unwrap().roles;
if (roles.root.isSome) throw new Error("the pool still has a root");

writeFileSync(
  DEPLOYMENT,
  `${JSON.stringify({ vault, poolIds: [poolId], founder: wallet.address, firstBlock, links: [["Prize contract account", evmToSs58(vault), `/accounts/${evmToSs58(vault)}`], ...links] }, null, 2)}\n`,
);
console.log(`Scanner: ${SCANNER}/accounts/${evmToSs58(vault)}`);
console.log("Wrote web/src/deployment.json. Rebuild the site to publish it.");

await api.disconnect();
process.exit(0);
