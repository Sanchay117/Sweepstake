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
| Prize contract | [`0x2C898e8E0511792A530AB7CFE6C7FC3FAa9C99aF`](https://scanner-testnet-v3.portaldot.dev/#/accounts/5D56pvJwuWPKwmuVisyq9Up8U97azqwBHGBiSojgsrd6nFyf), live, see [Testnet deployment](#testnet-deployment) |
| Pool | Nomination pool 1, the first on this testnet |
| Draws | 3 paid on the live chain, the first in [block 290955](https://scanner-testnet-v3.portaldot.dev/#/blocks/290955?tab=events) |
| Demo video | 2 minutes 51, filmed on the live testnet with a stand-in wallet, public link to follow |

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
| Solidity bytecode runs on Revive | Deployed in block 290907, 1,785 bytes, and the code matches this repository's build | Passed live |
| Ethereum transactions reach the pool pallet | The pool was opened, configured and joined entirely through the pallets address | Passed live |
| 100% commission reaches the contract | A 5 tPOT reward moved from the pool to the vault | Passed live |
| A stranger can claim it | A wallet with no role moved 1 tPOT into the vault in block 291191 | Passed live |
| `address(this).balance` sees that income | The contract paid out exactly what the pool sent it | Passed live |
| The operator cannot redirect the commission after setup | Roles read `root: null`, and `eth_estimateGas` for `setCommission` answers `DoesNotHavePermission` | Passed live, dry run |
| The off-chain ticket equals the contract's ticket | Draw 1, rebuilt with **Check it** on the website | Passed live |
| The contract pays a native account | Draw 1 paid 4.75 of 5 tPOT, and 0.25 to the keeper | Passed live |
| A browser can rebuild a draw | **Check it** on all three draws | Passed live |
| A browser can finish a draw | **Finish it** on the website paid draws 2 and 3, signed by a test wallet | Passed live |
| A member joins and leaves with no help from the contract | Two test wallets bonded and unbonded from the website, in blocks 291093 to 291231. Their tPOT is free after the chain's 672 era wait | Passed live |
| Ethereum RPC block hashes equal Solidity's `blockhash` | `npm run live-checks` | Passed live |
| The node keeps old state, so old draws stay checkable | `npm run live-checks`, state read at block 1 | Passed live |
| Staking rewards reach a draw | The pool's first rewards arrive once era 82 ends. Draws 1 to 3 were funded by sponsor transfers | Waiting for era 82 |
| A real MetaMask window signs | The website's wallet code is standard EIP-1193, but every signature so far came from a stand-in test wallet | Not tested yet |

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

Live on the Portaldot V3 testnet since November 2, 2026. `npm run setup` wrote these addresses and blocks to
[web/src/deployment.json](web/src/deployment.json), and the website's proof section reads from that file.

| Item | Value |
|---|---|
| Operator | `0xCB4a9671B44F58C48252D96642eB67ff35B06401`, native `5GfFjaXp9bEeT17Qe4Xn77n6uZxeGXKR72GVrj1hGwk6whWg` |
| PrizeVault | `0x2C898e8E0511792A530AB7CFE6C7FC3FAa9C99aF`, native [`5D56pvJwuWPKwmuVisyq9Up8U97azqwBHGBiSojgsrd6nFyf`](https://scanner-testnet-v3.portaldot.dev/#/accounts/5D56pvJwuWPKwmuVisyq9Up8U97azqwBHGBiSojgsrd6nFyf) |
| Nomination pool | Pool 1, stash `5EYCAe5ijiYfAXEth5DCfmQ9jnv4BFmdonKpbxwrc2nAw5uj`, nominating both active validators |
| Bonded | 200 tPOT: a 20 tPOT founding bond, which is left out of the draw, and 3 test members of 60 tPOT. Two 10 tPOT test bonds are unbonding |
| Explorer | https://scanner-testnet-v3.portaldot.dev |

Every step below is an Ethereum transaction signed by one key.

| Step | Block | Transaction |
|---|---|---|
| Contract deployed | [290907](https://scanner-testnet-v3.portaldot.dev/#/blocks/290907?tab=events) | `0xf862cbc0bada374dea66db720cc8e21fd2686fd51d14e6b8d3909f4fe26988b1` |
| Pool opened | [290908](https://scanner-testnet-v3.portaldot.dev/#/blocks/290908?tab=events) | `0x02a34d03df943e15b3fb710f13dc6d70c304b7ba66ea9033f47020c58d62fbb3` |
| Commission set to 100% | [290909](https://scanner-testnet-v3.portaldot.dev/#/blocks/290909?tab=events) | `0x24ac46f22f41011f94d478e99980954b16d1e16b8dca25db0b0369ea778e85b1` |
| Commission claim opened to anyone | [290910](https://scanner-testnet-v3.portaldot.dev/#/blocks/290910?tab=events) | `0x47e9dc6f9952213cff16330146beeed072962ee68e24c7ce578ead59052ac272` |
| Pool nominated | [290911](https://scanner-testnet-v3.portaldot.dev/#/blocks/290911?tab=events) | `0x01d88594b03b7bfa9a2f7e8192586ea04c6529d2506f84c6347a76287fe88696` |
| Root role renounced | [290912](https://scanner-testnet-v3.portaldot.dev/#/blocks/290912?tab=events) | `0x4ed3a5052bc009edce214d1a9bcc3bb0fc19b0ca40fefdd019dd5502e201b9dc` |

**Draw 1.** A 5 tPOT sponsor transfer funded it, because staking rewards take two eras to arrive, and that showed a
prize can be added by anyone. The website rebuilds it with **Check it**.

| Step | Value |
|---|---|
| Sponsor transfer | `0xa36750534f2caa0581f05bb692461430eff017c3b60447feca6cdf6fbeb6f00f` |
| Commission claimed into the vault | `0x7894c5a422ef99666b36487087d0f1357329d5ff635cea559595cb9b1bbf306b` |
| Snapshot | Block 290941, 3 members, 180 tPOT |
| Committed | `0x7ae90c7eae694a9ecb9b2bedbc15ccba7acdafe20f4951f2e92a76e90dbd3141` |
| Draw block | 290951, ticket 11010863810202332 |
| Paid | [Block 290955](https://scanner-testnet-v3.portaldot.dev/#/blocks/290955?tab=events), `0x242d97f42ed8fe65722c1811fc7ab2247c0490342bd94903da844839e0e3eba7` |
| Winner | `0x44d11934fe9667104879A1570d74eD2B81e52a50`, 4.75 tPOT |
| Keeper fee | 0.25 tPOT |

**Draws 2 and 3.** These were sponsored too, and the keeper stopped after committing them. A test wallet finished each
one with the website's **Finish it** button, which is what the demo video films. Each wallet also bonded 10 tPOT and
unbonded from the website.

| Step | Draw 2 | Draw 3 |
|---|---|---|
| Wallet | `0x9B6fDF6dCFb3Cd6d430A1DB5175D2e97D7784E14` | `0x7A9a95f779130cbBB6afA988791277f6A1009D4f` |
| Committed at snapshot | Block 291071, `0xf32a49d6aedf50751986e92f402a54bf4da2bbaecc91bd2c9f5a725a4febbade` | Block 291203, `0xbb81590adb81250697c74f96483a2e5f7506b03cb845058dfd3d2a6b4ce5439e` |
| Bonded | [Block 291093](https://scanner-testnet-v3.portaldot.dev/#/blocks/291093?tab=events), `0x169719c56abdfcf0884ec78b9bc83d026031deaad5268ec6261117fac86dd830` | [Block 291223](https://scanner-testnet-v3.portaldot.dev/#/blocks/291223?tab=events), `0x66622b291500616aa4dc0ff2956262be6dcdabc70a9a4cd8968fb28b6ec68053` |
| Paid from the website | [Block 291098](https://scanner-testnet-v3.portaldot.dev/#/blocks/291098?tab=events), `0xf869e1b04724f3f3b35eed6945adfd5d7b990723c07d2a99e01c283520116f82` | [Block 291228](https://scanner-testnet-v3.portaldot.dev/#/blocks/291228?tab=events), `0x76fb26e34c4fb1472d1a5815c7fe579a9b01041ce039836ee09794f23c176b70` |
| Winner | `0x44d11934fe9667104879A1570d74eD2B81e52a50`, 1.9 tPOT | `0x53AB03f9F8bD348fEFbC9E38E123B67bD18e648e`, 0.95 tPOT |
| Unbonded | [Block 291101](https://scanner-testnet-v3.portaldot.dev/#/blocks/291101?tab=events), `0xf65326b3f8c104cbd08637a7ceb368395d5cfc93fde88d4ffe4de203716bb790` | [Block 291231](https://scanner-testnet-v3.portaldot.dev/#/blocks/291231?tab=events), `0xd9fb988a31b5656b787197d85b4a8b389655a329945cca54f56c652cfe05ef27` |

The commission for draw 3 was claimed by a wallet with no role, in
[block 291191](https://scanner-testnet-v3.portaldot.dev/#/blocks/291191?tab=events),
`0x57ba2012ca03faa05041878aa007bdd3cba760c7c4850a06f299a426f9c827fc`.

## Repository

```text
contracts/       PrizeVault.sol and its Foundry tests
shared/          Draw maths, pallet call encoding and the ABI, used by keeper and website alike
keeper/lib/      Chain, wallet and pool helpers
keeper/scripts/  setup, seed-members, sponsor, crank, film-wallet and live-checks
keeper/fork/     Fork config, the full rehearsal, and the bridge that lets the website read a fork
keeper/test/     Tests of the shared code
web/             The website, with no backend: every number is read from the chain in the browser
video/           The demo film: script, narration, score, screen capture and Remotion scenes
docs/            Architecture, deployment and the DoraHacks submission text
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

All of it is used as published. Everything here is open source except the two tools that only make the film.

- [Foundry](https://github.com/foundry-rs/foundry) and forge-std, for contract tests only
- [polkadot.js](https://github.com/polkadot-js/api), in the keeper
- [ethers](https://github.com/ethers-io/ethers.js), in the keeper and the website
- [Chopsticks](https://github.com/AcalaNetwork/chopsticks), to fork the live chain for rehearsals
- [Vite](https://github.com/vitejs/vite), to build the website
- Besley, Petit Formal Script, Source Serif 4 and IBM Plex Mono, through [Fontsource](https://github.com/fontsource/fontsource)
- [Playwright](https://github.com/microsoft/playwright) and [ffmpeg](https://ffmpeg.org), to make the film
- [Remotion](https://github.com/remotion-dev/remotion), to make the film. Its source is public and it is free for
  individuals, under the [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)
- [Deepgram](https://deepgram.com) Aura 2, a paid speech service, for the film's narration

The contract, keeper, website and film were written for this hackathon. The film's score and sound effects are
generated by code in `video/scripts`.

## Sources

Hansard, HC Deb 18 June 1956 vol 554 and 31 January 1966 vol 723. Premium Bonds and ERNIE figures from NS&I and
Wikipedia. Sweepstake has no connection to NS&I or the Government of India.

## License

MIT
