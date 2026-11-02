# Architecture

Sweepstake is one small contract, one native nomination pool, one keeper script and a website with no backend.
This page explains why it has that shape.

## The main decision: no contract holds deposits

The usual no-loss prize design puts every deposit in a vault contract. That vault becomes the largest honeypot in
the system, and it needs an audit that a hackathon project cannot have.

Portaldot V3 allows something better. Members bond directly into a native nomination pool, and the pool sends its
yield to our contract through commission. The contract only ever holds what was already going to be given away.

| | Vault design | Sweepstake |
|---|---|---|
| Where deposits sit | A contract | A keyless native pool account |
| What a contract bug can lose | Everything | One prize |
| How a member leaves | Through the contract | `nominationPools.unbond`, which needs nothing from us |
| What the yield is | Whatever the vault can farm | The chain's own staking reward |

## The money loop

1. A member's wallet calls `nominationPools.join` through the pallets address.
2. The pool nominates validators and earns staking rewards each 6 hour era.
3. Pool commission is set to 100% with the vault's account as payee, and the claim permission is `Permissionless`.
4. `nominationPools.claimCommission` moves the rewards into the vault. Anyone can call it.
5. The keeper commits a snapshot. Five blocks later anyone can call `draw`.

During setup, the pool's root and bouncer roles are removed with `updateRoles`. Root is the only role that can
change the commission, so removing it makes the payee permanent. The operator keeps the nominator role, which can
pick validators and cannot move funds.

## Making an Ethereum wallet speak to a pallet

Revive gives each H160 address a native twin: the 20 address bytes followed by twelve `0xEE` bytes. A top level
Ethereum transaction sent to the pallets address `0x6d6f646c70792f70616464720000000000000000`, with a SCALE encoded
runtime call as its data, dispatches that call from the twin account through `revive.ethSubstrateCall`.

This only works for top level transactions. A Solidity contract calling that address does nothing, so a contract
cannot stake. That limit is why the design has the shape it does.

Facts we confirmed on this runtime:

- `AutoMap` is on, so a native account is mapped into Revive when a transfer creates it. `mapAccount` is a no-op.
- Revive increments a deployer's nonce an extra time during instantiation.
- `eth_estimateGas` includes storage deposits, so fixed gas limits fail. Every send here uses the node's estimate.
- A failed dispatch comes back from the estimate with the pallet's own error, such as `PoolNotFound`.

## The snapshot

Solidity cannot read pallet storage. So the keeper reads `nominationPools.poolMembers` at a block, lays each
member's points end to end in address order, and commits the Merkle root of those intervals.

```text
leaf = keccak256(abi.encodePacked(address, start, weight))
```

Pairs are sorted before hashing, and an odd node moves up unchanged. The operator's founding stake is left out, so
the operator holds no tickets.

`commit` also records `snapshotBlock`, the exact block the keeper read. Without it, a member joining between the
keeper's read and its transaction would make an honest round impossible to rebuild. The contract refuses a
snapshot that does not predate the commit.

## The draw

```text
seed   = keccak256(abi.encode(blockhash(drawBlock), root, round))
ticket = seed % totalWeight
```

`drawBlock` is five blocks after the commit, so its hash did not exist when the membership was fixed. The winner is
whoever's interval holds the ticket. `draw` takes that member's interval and Merkle proof, checks both, and pays
95% to the winner and 5% to the keeper.

A round that nobody draws within 200 blocks can be replaced, because `blockhash` only looks back so far. The prize
rolls over.

## What the keeper can and cannot do

`commit` is the only keeper-only call, so the keeper is a convenience rather than a trust root for funds.

- It cannot touch principal. Nothing in the system can.
- It cannot change the commission, because the pool's root is gone.
- It cannot stop a draw. `draw` is open to anyone, and the website's "Finish it" button runs the whole thing from a
  visitor's browser. So a keeper cannot sit on a result it dislikes.
- It can commit a false root. It cannot hide one, because the snapshot block is public and the node keeps state back
  to block 1. The website's "Check it" button rebuilds any round and says if it does not match.

## The website

There is no server. The page calls the node's HTTP JSON-RPC and the Ethereum RPC directly, decodes raw storage
itself, and shares `shared/draw.mjs` with the keeper. So the code that verifies a draw is the same code that ran it,
and a visitor can read every step in their browser.

## Scaling past one pool

A pool holds 32 members and the chain allows 16 pools. The vault does not care how many pools pay it, and the
snapshot takes a list of pool ids, so more pools raise capacity to 512 members with no contract change. Going beyond
that needs a chain parameter change.

## Costs on this chain

Storage deposits shape the contract. `PrizeVault` is 1,785 bytes of runtime code and costs about 153 tPOT to deploy,
most of it deposit. Each round reuses the same storage slots, and history lives in events, so running it costs fees
rather than more deposits.
