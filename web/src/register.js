// The public records: who holds tickets, what each draw did, and the check anyone can run.
import { buildSnapshot, merkleProof, merkleRoot, ticketFor, winnerIndex } from "../../shared/draw.mjs";
import { DRAW_WINDOW } from "../../shared/vault.mjs";
import { blockHashes, formatPot, readMembers, vaultAbi } from "./rpc.js";

const SCANNER = "https://scanner-testnet-v3.portaldot.dev/#";

const short = (address) => `${address.slice(0, 8)}…${address.slice(-6)}`;

function odds(points, total) {
  if (total === 0n) return "0%";
  return `${(Number((points * 10_000n) / total) / 100).toFixed(2)}%`;
}

export function renderRegister({ members }) {
  const body = document.querySelector("[data-register]");
  const total = members.reduce((sum, member) => sum + member.points, 0n);
  body.textContent = "";
  if (members.length === 0) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.textContent = "No bonds issued yet.";
    return;
  }
  [...members]
    .sort((a, b) => (a.points < b.points ? 1 : -1))
    .forEach((member) => {
      const row = body.insertRow();
      row.insertCell().textContent = short(member.address);
      row.insertCell().textContent = formatPot(member.points, 0);
      row.insertCell().textContent = odds(member.points, total);
    });
}

export function renderHolding({ wallet, members }) {
  const empty = document.querySelector("[data-holding-empty]");
  const facts = document.querySelector("[data-holding-facts]");
  const unbond = document.querySelector("[data-unbond]");
  if (!wallet) return;
  const mine = members.find((member) => member.address.toLowerCase() === wallet.toLowerCase());
  empty.textContent = "This wallet holds no bond yet.";
  empty.hidden = Boolean(mine);
  facts.hidden = !mine;
  unbond.hidden = !mine;
  if (mine) {
    const total = members.reduce((sum, member) => sum + member.points, 0n);
    document.querySelector('[data-holding="tickets"]').textContent = formatPot(mine.points, 0);
    document.querySelector('[data-holding="odds"]').textContent = odds(mine.points, total);
  }
}

/** A fresh steps list. Each step reports what it compared and how that went. */
function steps() {
  const list = document.querySelector("[data-checks]");
  list.hidden = false;
  list.textContent = "";
  return (text) => {
    const item = document.createElement("li");
    item.textContent = text;
    list.append(item);
    return {
      pass: (result) => {
        item.textContent = result;
        item.classList.add("is-ok");
      },
      fail: (result) => {
        item.textContent = result;
        item.classList.add("is-bad");
      },
    };
  };
}

async function rebuildSnapshot(round, deployment) {
  const { substrate } = await blockHashes(round.snapshotBlock);
  const members = await readMembers(deployment.poolIds, {
    at: substrate,
    exclude: deployment.founder ? [deployment.founder] : [],
  });
  return buildSnapshot(members);
}

/** Rebuilds a finished round in the browser. */
async function checkDraw(round, deployment) {
  const step = steps();
  let line = step(`Reading every bond at block ${round.snapshotBlock}`);
  let snapshot;
  try {
    snapshot = await rebuildSnapshot(round, deployment);
    line.pass(`Rebuilt ${snapshot.entries.length} bonds from chain state at block ${round.snapshotBlock}`);
  } catch (error) {
    line.fail(`This node would not serve state from block ${round.snapshotBlock}: ${error.message}`);
    return;
  }

  line = step("Comparing the Merkle root");
  const root = merkleRoot(snapshot);
  if (root !== round.root) {
    line.fail(`Root mismatch: rebuilt ${root}, committed ${round.root}`);
    return;
  }
  line.pass(`Root matches the commitment: ${root}`);

  line = step(`Reading the hash of block ${round.drawBlock}`);
  const { ethereum } = await blockHashes(round.drawBlock);
  const ticket = ticketFor({ blockHash: ethereum, root, round: BigInt(round.id), total: round.total });
  if (ticket !== round.ticket) {
    line.fail(`Ticket mismatch: rebuilt ${ticket}, contract used ${round.ticket}`);
    return;
  }
  line.pass(`Block ${round.drawBlock} gives ticket ${ticket}, the one the contract used`);

  line = step("Finding the holder of that ticket");
  const entry = snapshot.entries[winnerIndex(snapshot, ticket)];
  if (entry?.address !== round.winner.toLowerCase()) {
    line.fail(`Winner mismatch: rebuilt ${entry?.address}, paid ${round.winner}`);
    return;
  }
  line.pass(`Ticket belongs to ${round.winner}, who was paid ${formatPot(round.prize, 4)} tPOT`);
}

/** Finishes a round from this browser, so the keeper cannot sit on a result it dislikes. */
async function finishDraw(round, deployment, counter) {
  const step = steps();
  const line = step(`Rebuilding draw ${round.id} from block ${round.snapshotBlock}`);
  try {
    const from = await counter.ensureWallet();
    const snapshot = await rebuildSnapshot(round, deployment);
    if (merkleRoot(snapshot) !== round.root) throw new Error("the rebuilt root does not match the commitment");
    const { ethereum } = await blockHashes(round.drawBlock);
    const ticket = ticketFor({ blockHash: ethereum, root: round.root, round: BigInt(round.id), total: round.total });
    const index = winnerIndex(snapshot, ticket);
    const entry = snapshot.entries[index];
    line.pass(`Ticket ${ticket} belongs to ${entry.address}`);

    const sending = step("Waiting for your signature");
    const data = vaultAbi.encodeFunctionData("draw", [entry.address, entry.start, entry.weight, merkleProof(snapshot, index)]);
    const hash = await counter.sendCall(from, deployment.vault, data);
    sending.pass(`Paid from this browser. Transaction ${hash}`);
    await counter.refresh();
  } catch (error) {
    line.fail(counter.friendly(error));
  }
}

function roundRow(heading, detail, action) {
  const item = document.createElement("li");
  const title = document.createElement("span");
  title.textContent = heading;
  item.append(title);
  if (action) {
    const button = document.createElement("button");
    button.className = "press press--quiet";
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", action.run);
    item.append(button);
  }
  const line = document.createElement("span");
  line.textContent = detail;
  item.append(line);
  return item;
}

export function renderDraws({ rounds, block }, deployment, counter) {
  const list = document.querySelector("[data-draws]");
  list.textContent = "";
  if (rounds.length === 0) {
    list.append(roundRow("No draws yet.", "The first one follows the first era's rewards."));
    return;
  }
  for (const round of rounds) {
    if (round.winner) {
      list.append(
        roundRow(`Draw ${round.id}: ${formatPot(round.prize, 4)} tPOT`, `${short(round.winner)} at block ${round.paidBlock}`, {
          label: "Check it",
          run: () => checkDraw(round, deployment),
        }),
      );
    } else if (block <= round.drawBlock) {
      list.append(roundRow(`Draw ${round.id} is committed`, `Waiting for the hash of block ${round.drawBlock}.`));
    } else if (block <= round.drawBlock + DRAW_WINDOW) {
      list.append(
        roundRow(`Draw ${round.id} is ready`, "Anyone can finish it, including you.", {
          label: "Finish it",
          run: () => finishDraw(round, deployment, counter),
        }),
      );
    } else {
      list.append(roundRow(`Draw ${round.id} lapsed`, `Nobody finished it within ${DRAW_WINDOW} blocks, so the prize rolled over.`));
    }
  }
}

export function renderProof(deployment) {
  const list = document.querySelector("[data-proof]");
  const rows = [
    ["Network", "Portaldot V3 testnet, EVM chain 420420777, runtime spec 3002"],
    ["Prize contract", deployment.vault ?? "not deployed yet"],
    ["Pool", deployment.vault ? `Nomination pool ${deployment.poolIds.join(", ")}` : "not opened yet"],
    ...deployment.links,
  ];
  list.textContent = "";
  for (const [name, value, href] of rows) {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = name;
    const detail = document.createElement("dd");
    if (href) {
      const link = document.createElement("a");
      link.href = href.startsWith("http") ? href : `${SCANNER}${href}`;
      link.textContent = value;
      link.rel = "noreferrer";
      detail.append(link);
    } else {
      detail.textContent = value;
    }
    row.append(term, detail);
    list.append(row);
  }
}
