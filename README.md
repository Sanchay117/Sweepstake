# Sweepstake

**Premium Prize Bonds for POT. Stake POT, keep it, and one member wins everyone's yield.**

Built for the Portaldot Hacker House 2026, Ecosystem DApps track.

Staking rewards on one small balance are too small to notice. Pooled and paid to one member, they can
change someone's week. Britain has run this idea since 1956 and holds more than £137 billion of Premium
Bonds. Sweepstake is the same machine on Portaldot V3, with one difference: nobody has to trust a government
or a contract with their deposit, because no contract ever holds it.

| | |
|---|---|
| Website | Not published yet |
| Network | Portaldot V3 testnet, EVM chain 420420777, runtime spec 3002 |
| Prize contract | Not deployed yet, see [Testnet deployment](#testnet-deployment) |
| Demo video | Not recorded yet |

## How it works

```text
             MetaMask signs nominationPools.join
  Member ───────────────────────────────────────────▶ Nomination pool
    ▲                                                 keyless native account,
    │                                                 root role renounced
    │                                                       │
    │ 95% of everything                                     │ staking rewards
    │ the pool earned                                       ▼
    │                                                 100% commission,
    └────────────── PrizeVault ◀──────────────────── claimable by anyone
                 1,785 byte Solidity contract
```

1. **You bond.** A MetaMask transaction to Portaldot's pallets address runs `nominationPools.join` as a real
   native call. Your tPOT moves to the pool's own account, which has no private key.
2. **The pool stakes.** It earns the chain's staking rate, currently 25.07% a year, paid every 6 hour era.
3. **The pool pays no interest.** Its commission is 100%, payable to `PrizeVault`, and its root role is
   renounced so nobody can change that. Whatever the contract holds is the prize.
4. **A number nobody knows yet.** The keeper commits a Merkle root of every bond and names the block it read
   them at. Five blocks later, a block hash that did not exist at commit time picks the ticket.
5. **One bond wins.** Anyone can submit the proof, including from the website. The contract pays 95% to the
   winner and 5% to the keeper. Every bond stays in the next draw.

## Why this needs Portaldot

Sweepstake is not a Solidity app that could be copied to any EVM chain. It needs three things that sit together
on Portaldot V3:

- **Native staking pools.** Yield comes from the chain itself, not from a token emission.
- **Ethereum transactions that run as native calls.** A contract cannot stake on this chain, but a MetaMask user
  can, through the pallets address. So deposits never touch a contract.
- **Solidity on Revive, reading a native account's income.** Pool commission lands in the contract's account as
  a plain native transfer, and Solidity sees it as `address(this).balance`.

The result is that the worst a bug in our contract can lose is one prize. Members' principal stays in a native
pool, and anyone can leave using only the chain's own pallet.

## What has been proven

| Claim | How it was checked | Status |
|---|---|---|
| Solidity bytecode runs on Revive | Deployed on a fork of the live chain | Passed on fork |
| 100% commission reaches the contract, and a stranger can claim it | Fork rehearsal, step 4 | Passed on fork |
| `address(this).balance` sees that income | Fork rehearsal | Passed on fork |
| The operator cannot redirect the commission after setup | Fork rehearsal, expects `DoesNotHavePermission` | Passed on fork |
| The off-chain ticket equals the contract's ticket | Fork rehearsal | Passed on fork |
| The contract pays a native account | Fork rehearsal, the winner received 4.75 of 5 tPOT | Passed on fork |
| A member leaves with no help from the contract | Fork rehearsal, `unbond` | Passed on fork |
| A browser can rebuild a draw and finish one | Website run against the fork | Passed on fork |
| An Ethereum transaction reaches the pool pallet | `eth_estimateGas` on the live chain answers `PoolNotFound` from pallet 62 | Passed live, dry run |
| Ethereum RPC block hashes equal Solidity's `blockhash` | `npm run live-checks` | Passed live |
| The node keeps old state, so old draws stay checkable | `npm run live-checks`, state read at block 1 | Passed live |
| The whole loop with real rewards | Live deployment | Waiting for testnet tPOT |

## Run it yourself

You need Node 22 or later and [Foundry](https://getfoundry.sh).

```bash
git clone <this repository>
cd sweepstake
npm install
forge install foundry-rs/forge-std --root "$PWD/contracts" --no-git
```

**Tests.** 21 contract tests, including fuzzing, and 11 tests of the shared draw maths and call encoding.

```bash
forge test --root contracts
npm test
```

**The full loop, on a fork of the live chain.** Nothing here touches the real testnet. The first start takes a
few minutes, because the fork lazily pulls state from a public node.

```bash
forge build --root contracts
npm run fork
```

Then, in a second terminal:

```bash
npm run rehearse
```

**The website, on that fork.** This serves the fork's real state to the page, including a draw you can check and
finish.

```bash
npm run stage
```

The bridge keeps running, so give it a third terminal:

```bash
npm run bridge
```

And the website a fourth:

```bash
npm run dev --prefix web -- --mode fork
```

**The website, on the live testnet.**

```bash
npm run dev --prefix web
```

**Read-only checks against the live chain.**

```bash
npm run live-checks
```

Deployment and the keeper are covered in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The reasoning behind the design
is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Testnet deployment

Not deployed yet. The operator is waiting for testnet tPOT. `npm run setup` writes every address, block and
explorer link to [web/src/deployment.json](web/src/deployment.json), and the website's proof section reads from
that file.

| Item | Value |
|---|---|
| Operator | `0xCB4a9671B44F58C48252D96642eB67ff35B06401`, native `5GfFjaXp9bEeT17Qe4Xn77n6uZxeGXKR72GVrj1hGwk6whWg` |
| PrizeVault | Not deployed yet |
| Nomination pool | Not opened yet |
| Explorer | https://scanner-testnet-v3.portaldot.dev |

## Repository

```text
contracts/       PrizeVault.sol and its Foundry tests
shared/          Draw maths, pallet call encoding and the ABI, used by keeper and website alike
keeper/lib/      Chain, wallet and pool helpers
keeper/scripts/  setup, seed-members, crank and live-checks
keeper/fork/     Fork config, the full rehearsal, and the bridge that lets the website read a fork
keeper/test/     Tests of the shared code
web/             The website, with no backend: every number is read from the chain in the browser
docs/            Architecture and deployment
```

## Security and limits

- No contract ever holds a deposit, so the most a contract bug can lose is the prize waiting in it.
- The keeper can post a false snapshot. It cannot hide one, because anyone can rebuild it from chain state, and
  the website does that with one click. The contract does not stop it.
- The draw uses a block hash, so a block author could withhold a block to try for a different ticket. They would
  give up that block to do it.
- A pool holds 32 members and the chain allows 16 pools, so Sweepstake holds 512 members today. The draw already
  reads several pools at once.
- Unbonding takes 672 eras, which is 168 days on this testnet. That is the chain's staking rule. Nobody can
  shorten it, including us.
- This is unaudited testnet software, and tPOT has no value.

## Third-party code

All of it is open source and used as published.

- [Foundry](https://github.com/foundry-rs/foundry) and forge-std, for contract tests only
- [polkadot.js](https://github.com/polkadot-js/api), in the keeper
- [ethers](https://github.com/ethers-io/ethers.js), in the keeper and the website
- [Chopsticks](https://github.com/AcalaNetwork/chopsticks), to fork the live chain for rehearsals
- [Vite](https://github.com/vitejs/vite), to build the website
- Besley, Petit Formal Script, Source Serif 4 and IBM Plex Mono, through [Fontsource](https://github.com/fontsource/fontsource)

The contract, keeper and website were written for this hackathon.

## Sources

Hansard, HC Deb 18 June 1956 vol 554 and 31 January 1966 vol 723. Premium Bonds and ERNIE figures from NS&I and
Wikipedia. Sweepstake has no connection to NS&I or the Government of India.

## License

MIT
