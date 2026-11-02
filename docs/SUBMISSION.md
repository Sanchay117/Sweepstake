# DoraHacks submission

Paste these fields into the BUIDL form. Square brackets mark what can only be filled in once the public repository,
website and video are up.

## Name

Sweepstake

## Tagline

Premium Prize Bonds for POT. Stake POT, keep it, and one member wins everyone's yield.

## Track

Ecosystem DApps

## Links

| | |
|---|---|
| Repository | [GitHub URL] |
| Website | [website URL] |
| Demo video | [video URL] |
| Pitch deck | [deck URL] |
| Prize contract | `0x2C898e8E0511792A530AB7CFE6C7FC3FAa9C99aF` on Portaldot V3 testnet, https://scanner-testnet-v3.portaldot.dev/#/accounts/5D56pvJwuWPKwmuVisyq9Up8U97azqwBHGBiSojgsrd6nFyf |
| First draw | `0x242d97f42ed8fe65722c1811fc7ab2247c0490342bd94903da844839e0e3eba7`, https://scanner-testnet-v3.portaldot.dev/#/blocks/290955?tab=events |

## Description

Staking rewards on one small balance are too small to notice. Pooled and paid to one member, they can change
someone's week.

Britain has run this idea since 1956. The critics called it a squalid raffle, and today more than £137 billion sits
in the draw. In 1964 India printed the rule on the bond itself: no other interest will be payable on the bond but
prizes.

Sweepstake is that bond for POT. You bond POT into a native nomination pool from MetaMask, and it stays yours. The
pool stakes everything with Portaldot's validators, and all of its income flows to one small Solidity contract as
commission. Each draw pays that income to one member, chosen by a block hash that did not exist when the bonds were
committed. Everyone keeps their principal and stays in the next draw.

It gives people a reason to stake POT who would never stake for 25% of a small balance, and it brings more POT
staked by more people to Portaldot's validators.

## How it works

1. **You bond.** A MetaMask transaction to Portaldot's pallets address runs `nominationPools.join` as a real native
   call. Your POT moves to the pool's own account, which has no private key.
2. **The pool stakes.** It earns the chain's staking rate, currently 25.07% a year on the testnet, paid every era.
3. **The pool pays no interest.** Its commission is 100%, payable to `PrizeVault`, a Solidity contract of 1,785
   bytes. The pool's root and bouncer roles are renounced, so nobody can redirect it.
4. **A number nobody knows yet.** The keeper commits a Merkle root of every bond and names the block it read them
   at. Five blocks later, a block hash that did not exist at commit time picks the ticket.
5. **One bond wins.** Anyone can submit the proof, from the website if they like. The contract pays 95% to the
   winner and 5% to the keeper. Any browser can rebuild the round from public chain state and land on the same
   winner.

## Why Portaldot is essential

Sweepstake could not be copied to another EVM chain. It needs three things that sit together on Portaldot V3:

- **Native staking pools.** Yield comes from the chain itself, not from a token emission.
- **Ethereum transactions that run as native calls.** A MetaMask user can reach the pool pallet directly through the
  pallets address, so one wallet does everything and deposits never touch a contract.
- **Solidity on Revive, reading native income.** Pool commission lands in the contract's account as a plain native
  transfer, and Solidity sees it as `address(this).balance`.

Take any one away and the product stops working. Because no contract ever holds a deposit, the worst a bug can lose
is one prize.

## Proof

- **Live on the V3 testnet.** `PrizeVault` is deployed at `0x2C898e8E0511792A530AB7CFE6C7FC3FAa9C99aF`, and pool 1 is
  the first nomination pool on the testnet. It has 200 tPOT staked with both validators.
- **A real draw has been paid.** Draw 1 moved a 5 tPOT sponsored prize from the pool to the contract, committed 3
  members, took its ticket from block 290951, and paid 4.75 tPOT in block 290955. The website rebuilds that round from
  public chain state and lands on the same winner.
- **The renounce holds.** The pool's root and bouncer read null, and a dry run of the operator changing the commission
  answers `DoesNotHavePermission`.
- 21 contract tests, including fuzzing, and 11 tests of the shared draw maths and call encoding.
- A full rehearsal on a fork of the live chain: deploy, renounce, stake, claim, commit, draw, pay, unbond.
- The website bonding, finishing a draw, checking it and unbonding on that fork, which is what the demo video films.
- A fresh clone reproduces every step from the README.

The README's "What has been proven" table says which claims passed on a fork and which passed live, and lists every
transaction.

## Business model

A member keeps the whole bond and gives up only the yield, for a chance at everyone's. 5% of each prize pays the
keeper who runs the draw, so the draw does not depend on a grant. At the testnet's current 25.07% a year, that comes
to about 1.25% a year of everything bonded. Any project can add to a prize with a plain transfer, so partners can
sponsor draws.

## Reasons for continued support

- **It adds staked POT.** Every bond is native stake, and no prize ever spends a bond.
- **It needs no emissions.** Prizes come from yield the chain already pays, so no token or grant funds them.
- **It runs itself.** The fee pays for the draw, and anyone can finish one if the keeper stops.
- **Its next step is clear.** Audit, mainnet, then more pools. Reaching 512 members needs no contract change.

## Tech stack

Solidity on Revive, Foundry, polkadot.js, ethers, Chopsticks, Vite and plain JavaScript, with no backend. The film
uses Remotion, Deepgram, Playwright and ffmpeg.

## Third-party disclosure

All third-party code is listed in the README with what it is used for. It is open source, except Remotion, which
renders the film under its own free license for individuals. The contract, keeper, website and film were written
for this hackathon. The narration is synthesized with Deepgram's Aura 2 voices. The score and sound effects are
generated by code in this repository.

## Discord post for the community vote

Not part of the form. Post it when voting opens on Nov 9 at 16:00 UTC.

> Sweepstake is Premium Prize Bonds for POT. You bond POT from MetaMask into a native staking pool and it stays
> yours. The pool's rewards go to one small contract, and each draw pays them to one member. Everyone keeps their
> POT and stays in the next draw.
>
> Film, 2 minutes 38: [video URL]
> Try it on the testnet: [website URL]
> Vote: [voting link]
