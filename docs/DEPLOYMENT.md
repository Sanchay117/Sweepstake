# Deployment

These steps take Sweepstake from nothing to a live round on the Portaldot V3 testnet.

## Network

| | |
|---|---|
| Native RPC | `wss://test-node-v3.portaldot.dev` |
| EVM RPC | `https://test-evm-rpc-v3.portaldot.dev` |
| Chain id | `420420777` (`0x190f1ca9`) |
| Token | tPOT, 14 decimals natively, 18 in the EVM |
| Scanner | https://scanner-testnet-v3.portaldot.dev |

## 1. Create the operator

```bash
node keeper/scripts/new-operator.mjs
```

This writes a fresh key to `.env`, which git ignores, and prints the addresses. It refuses to overwrite an existing
file. One key does everything: it deploys the contract, opens the pool and runs the keeper.

## 2. Fund it

| Purpose | tPOT |
|---|---|
| Deploy `PrizeVault` | about 153 |
| Founding bond and fees | about 21 |
| Test members, if you seed them | 105 each at the default size |

## 3. Build and deploy

```bash
forge build --root contracts
npm run setup
```

`setup` deploys the vault, opens a pool, sets 100% commission to the vault, opens the commission claim to anyone,
nominates the validators and renounces the pool's root and bouncer roles. It then writes every address, block and
explorer link to `web/src/deployment.json`. It refuses to run twice.

A nomination counts from the next era, so the first rewards arrive about two eras later, or roughly 12 hours.

## 4. Add members

```bash
npm run seed-members -- 3 100
```

This bonds 3 test members with 100 tPOT each, using the same call a MetaMask user signs. Their keys derive from the
operator's key, so no new secrets exist.

## 5. Run the keeper

```bash
npm run crank
```

One turn pays out the last era if nobody has, claims commission, then commits and draws. It reads what the chain
needs next and does only that, so it is safe to rerun.

To run it every era, add `OPERATOR_PRIVATE_KEY` as a repository secret. The workflow in
`.github/workflows/keeper.yml` then runs it on a schedule.

## 6. Publish the website

```bash
npm run build --prefix web
```

`web/dist` is a static site, and any static host will serve it. With `web/src/deployment.json` filled in, the
"Specimen" overprint disappears and the page shows the live pool.

On GitHub, set **Settings > Pages > Source** to **GitHub Actions**. Every push to `main` then publishes the site
through `.github/workflows/pages.yml`. On another host, set `SITE_URL` during the build so link previews can find
`og.png`.

## Check it worked

```bash
npm run live-checks
```

Then open the website, go to the draws, and press **Check it**. Your browser rebuilds the round from chain state.
