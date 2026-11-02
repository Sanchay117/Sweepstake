// The post office counter: connects MetaMask and signs native pool calls through the EVM layer.
import { parseUnits } from "ethers";
import { bondExtra, joinPool, unbond, withdrawUnbonded } from "../../shared/calls.mjs";
import { evm, formatPot, POT, readBalance } from "./rpc.js";

const PALLETS = "0x6d6f646c70792f70616464720000000000000000";
const CHAIN = {
  chainId: "0x190f1ca9",
  chainName: "Portaldot V3 Testnet",
  nativeCurrency: { name: "tPOT", symbol: "tPOT", decimals: 18 },
  rpcUrls: ["https://test-evm-rpc-v3.portaldot.dev"],
  blockExplorerUrls: ["https://scanner-testnet-v3.portaldot.dev"],
};

const $ = (selector) => document.querySelector(selector);

function say(text, { error = false } = {}) {
  const status = $("[data-status]");
  status.textContent = text;
  status.classList.toggle("is-error", error);
}

/** Puts the wallet on Portaldot, adding the network the first time. */
async function useChain() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.chainId }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [CHAIN] });
  }
}

/** Signs a call. The node's estimate includes deposits, so a fixed gas limit would fail. */
async function sendCall(from, to, data) {
  const [gas, gasPrice] = await Promise.all([evm("eth_estimateGas", [{ from, to, data }]), evm("eth_gasPrice")]);
  const hash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, gas, gasPrice, value: "0x0" }],
  });
  for (let i = 0; i < 40; i += 1) {
    const receipt = await evm("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      if (receipt.status !== "0x1") throw new Error("The chain refused this transaction.");
      return hash;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("No receipt yet. Check the scanner before trying again.");
}

function friendly(error) {
  const message = error?.info?.error?.message ?? error?.message ?? String(error);
  if (error?.code === 4001 || /rejected/i.test(message)) return "You declined it in the wallet. Nothing was sent.";
  if (/FundsUnavailable|Inability to pay/i.test(message)) return "This wallet does not hold enough tPOT.";
  if (/MinimumBondNotMet/i.test(message)) return "The minimum bond is 1 tPOT.";
  if (/PoolNotFound/i.test(message)) return "Pool No. 1 is not open yet.";
  if (/MaxPoolMembers/i.test(message)) return "This pool is full. Each pool holds 32 members.";
  return message;
}

export function startCounter({ state, deployment, onWallet, onBonded }) {
  const connect = $("[data-connect]");
  const submit = $("[data-bond-submit]");
  const unbondButton = $("[data-unbond]");
  const withdrawButton = $("[data-withdraw]");
  const form = $("[data-bond-form]");

  const showBalance = async () => {
    const balance = await readBalance(state.wallet);
    $("[data-wallet-balance]").textContent = `${formatPot(balance, 4)} tPOT`;
  };

  async function ensureWallet() {
    if (state.wallet) return state.wallet;
    if (!window.ethereum) throw new Error("MetaMask is not installed in this browser.");
    const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    await useChain();
    state.wallet = account;
    $("[data-wallet-address]").textContent = account;
    connect.hidden = true;
    submit.hidden = false;
    say("");
    onWallet();
    await showBalance();
    await onBonded();
    return account;
  }

  async function connectWallet() {
    try {
      await ensureWallet();
    } catch (error) {
      say(friendly(error), { error: true });
    }
  }

  async function bond(event) {
    event.preventDefault();
    const amount = parseUnits($("[data-bond-amount]").value || "0", 14);
    if (amount < POT) {
      say("The minimum bond is 1 tPOT.", { error: true });
      return;
    }
    const mine = state.members.find((member) => member.address.toLowerCase() === state.wallet.toLowerCase());
    const data = mine ? bondExtra(amount) : joinPool(amount, deployment.poolIds[0]);
    submit.disabled = true;
    say("Waiting for your signature");
    try {
      const hash = await sendCall(state.wallet, PALLETS, data);
      say(`Bonded. Transaction ${hash}`);
      await showBalance();
      await onBonded();
    } catch (error) {
      say(friendly(error), { error: true });
    } finally {
      submit.disabled = false;
    }
  }

  /** Runs a call that concerns the wallet's own pool record. */
  async function act(button, makeCall, done) {
    const mine = state.members.find((member) => member.address.toLowerCase() === state.wallet.toLowerCase());
    if (!mine) return;
    button.disabled = true;
    say("Waiting for your signature");
    try {
      const hash = await sendCall(state.wallet, PALLETS, makeCall(mine));
      say(`${done} Transaction ${hash}`);
      await showBalance();
      await onBonded();
    } catch (error) {
      say(friendly(error), { error: true });
    } finally {
      button.disabled = false;
    }
  }

  connect.addEventListener("click", connectWallet);
  form.addEventListener("submit", bond);
  unbondButton.addEventListener("click", () => act(unbondButton, (mine) => unbond(mine.accountHex, mine.points), "Unbonding started."));
  withdrawButton.addEventListener("click", () => act(withdrawButton, (mine) => withdrawUnbonded(mine.accountHex), "Withdrawn."));

  return { ensureWallet, sendCall, friendly, refresh: onBonded };
}
