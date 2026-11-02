import "@fontsource/besley/500.css";
import "@fontsource/besley/600.css";
import "@fontsource/besley/700.css";
import "@fontsource/besley/800.css";
import "@fontsource/besley/900.css";
import "@fontsource/petit-formal-script/400.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./styles.css";

import { paintBond, paintHolding, paintReverse, paintWaves } from "./guilloche.js";
import { dateLine, postmarkSvg } from "./postmark.js";
import { numbering } from "./wheels.js";
import { readApr, readBlock, readEra, readMembers, readPrize, readRounds, formatPot } from "./rpc.js";
import { startCounter } from "./counter.js";
import { renderRegister, renderDraws, renderProof, renderHolding } from "./register.js";
import deployment from "./deployment.json";

document.documentElement.classList.add("js");

const $ = (selector) => document.querySelector(selector);
const fields = Object.fromEntries([...document.querySelectorAll("[data-field]")].map((el) => [el.dataset.field, el]));
const table = Object.fromEntries([...document.querySelectorAll("[data-table]")].map((el) => [el.dataset.table, el]));

const state = { block: 0, era: null, apr: null, members: [], prize: 0n, rounds: [], wallet: null };
const live = Boolean(deployment.vault);
let counter;

function paintAll() {
  paintBond($("[data-bond-print]"));
  paintWaves($("[data-waves]"));
  paintReverse($("[data-reverse-print]"));
  paintHolding($("[data-rosette]"), state.wallet);
}

const wheels = numbering($("[data-wheels]"));

function strikePostmark() {
  const slot = $("[data-postmark]");
  const last = state.rounds.find((round) => round.winner);
  const pool = `POOL No. ${deployment.poolIds[0]}`;
  slot.innerHTML = last
    ? postmarkSvg({
        ring: `PORTALDOT V3 TESTNET · ${pool} · DRAW ${last.id} ·`,
        date: dateLine(),
        middle: `#${last.drawBlock}`,
        foot: `${formatPot(last.prize, 3)} tPOT PAID`,
      })
    : postmarkSvg({
        ring: `PORTALDOT V3 TESTNET · ${pool} · OPEN ·`,
        date: dateLine(),
        middle: state.block ? `#${state.block}` : "BOND",
        foot: state.era ? `ERA ${state.era.index}` : "AWAITING DRAW",
      });
  if (!slot.classList.contains("is-struck")) {
    slot.classList.add("is-struck");
    setTimeout(() => {
      $("#bond").classList.add("is-hit");
      setTimeout(() => $("#bond").classList.remove("is-hit"), 260);
    }, 1370);
  }
}

function countdown() {
  if (!state.era?.endsAt) return "unknown";
  const left = Math.max(0, state.era.endsAt - Date.now());
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function renderHero() {
  const bonded = state.members.reduce((sum, member) => sum + member.points, 0n);
  fields.prize.textContent = live ? `${formatPot(state.prize, 4)} tPOT` : "not issued";
  fields.bonded.textContent = live ? `${formatPot(bonded, 0)} tPOT` : "not issued";
  fields.apr.textContent = state.apr ? `${state.apr.toFixed(2)}% a year` : "unavailable";
  fields.era.textContent = state.era ? `#${state.era.index} in ${countdown()}` : "unavailable";

  const prize = state.prize;
  const fee = (prize * 500n) / 10_000n;
  table.winner.textContent = live ? `${formatPot(prize - fee, 4)} tPOT` : "not issued";
  table.fee.textContent = live ? `${formatPot(fee, 4)} tPOT` : "not issued";
  table.total.textContent = live ? `${formatPot(prize, 4)} tPOT` : "not issued";
  document.querySelectorAll('[data-text="apr"]').forEach((el) => {
    if (state.apr) el.textContent = `${state.apr.toFixed(2)}% a year`;
  });
}

async function refreshBlock() {
  try {
    state.block = await readBlock();
    wheels.set(state.block);
  } catch {
    $("[data-wheels]").setAttribute("aria-label", "Block number unavailable");
  }
}

async function refreshChain() {
  const results = await Promise.allSettled([
    readEra(),
    readApr(),
    live ? readMembers(deployment.poolIds, { exclude: deployment.founder ? [deployment.founder] : [] }) : [],
    live ? readPrize(deployment.vault) : 0n,
    live ? readRounds(deployment.vault, deployment.firstBlock) : [],
  ]);
  const [era, apr, members, prize, rounds] = results.map((r) => (r.status === "fulfilled" ? r.value : null));
  if (era) state.era = era;
  if (apr) state.apr = apr;
  if (members) state.members = members;
  if (prize !== null) state.prize = prize;
  if (rounds) state.rounds = rounds;
  renderHero();
  renderRegister(state);
  renderDraws(state, deployment, counter);
  renderHolding(state);
  strikePostmark();
}

function watchTurn() {
  const stage = $("[data-turn]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    stage.classList.add("is-done");
    return;
  }
  const seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        setTimeout(() => stage.classList.add("is-done"), 750);
        seen.disconnect();
      }
    },
    { threshold: 0.55 },
  );
  seen.observe(stage);
}

function checkExhibit() {
  const figure = $("[data-exhibit]");
  const image = figure.querySelector("img");
  const missing = () => {
    figure.classList.add("is-missing");
    $(".thread").classList.add("is-solo");
  };
  image.addEventListener("error", missing);
  if (image.complete && image.naturalWidth === 0) missing();
}

async function boot() {
  $("[data-specimen]").hidden = live;
  document.querySelectorAll("[data-pool]").forEach((el) => (el.textContent = deployment.poolIds[0]));
  checkExhibit();
  await document.fonts.ready;
  paintAll();
  watchTurn();
  renderProof(deployment);
  counter = startCounter({ state, deployment, onWallet: () => paintHolding($("[data-rosette]"), state.wallet), onBonded: refreshChain });

  let resize;
  addEventListener("resize", () => {
    clearTimeout(resize);
    resize = setTimeout(paintAll, 160);
  });

  refreshBlock();
  refreshChain();
  setInterval(refreshBlock, 6000);
  setInterval(refreshChain, 30_000);
}

boot();
