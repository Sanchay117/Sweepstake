// Films the real website with Chrome's screencast, resampled to a constant 30 fps and encoded by
// ffmpeg, while a stand-in wallet signs real transactions on the live testnet. Writes:
//
//   public/capture/site.mp4        the footage
//   public/capture/site.json       the second offsets the film cuts on
//   public/capture/layers/*.png    the bond taken apart, so the teaser can print it layer by layer
//                                  and land exactly on the real page
//
// Start the website and `npm run film-wallet` with a fresh wallet number, and leave a draw open with
// `npm run crank -- --leave-open`. Each take bonds and unbonds for real, and an unbonded wallet is
// locked for 168 days. Each scene holds for as long as its narration, so voice first.
//
//   node scripts/capture.ts [--url http://localhost:5198] [--bond 10]

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { DEMO } from "../src/script.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "capture");
const layerDir = join(outDir, "layers");
mkdirSync(layerDir, { recursive: true });

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = flag("--url", "http://localhost:5198");
const bond = flag("--bond", "10");
/** A live transaction needs a block, and the receipt poll, on top of the wait for a slow node. */
const CHAIN_WAIT = 120_000;

const FPS = 30;
const VIEW = { width: 1600, height: 900 };
const SCALE = 1.2; // 1920 × 1080 frames

const manifest = JSON.parse(readFileSync(join(root, "public", "vo", "manifest.json"), "utf8"));
const line = (id: string) => DEMO.find((l) => l.id === id)!;
const need = (id: string) => (line(id).lead ?? 0.5) + manifest.lines[id].seconds + (line(id).tail ?? 0.8);
/** Seconds into a scene at which the narrator says `word`. */
function spoken(id: string, word: string) {
  const hit = manifest.lines[id].words.find((w: { text: string }) => w.text.toLowerCase().startsWith(word));
  return (line(id).lead ?? 0.5) + (hit?.start ?? 0);
}

const ffmpeg = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-",
   "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
   join(outDir, "site.mp4")],
  { stdio: ["pipe", "inherit", "inherit"] },
);

// Constant-rate resampling: the screencast only sends a frame when the page changes, so each
// frame is repeated until the next one's timestamp.
let t0 = 0;
let clockOffset = 0; // Date.now()/1000 − frame timestamp
let written = 0;
let last: Buffer | null = null;
const fill = (until: number) => {
  const target = Math.floor((until - t0) * FPS);
  while (last && written < target) {
    ffmpeg.stdin.write(last);
    written++;
  }
};

const marks: Record<string, number> = {};
const mark = (name: string) => {
  marks[name] = Math.round((Date.now() / 1000 - clockOffset - t0) * 100) / 100;
  console.log(`${marks[name].toFixed(2).padStart(7)}s  ${name}`);
};
const hold = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The stand-in for MetaMask: keeper/scripts/film-wallet.mjs signs each call and sends it to the chain.
const wallet = `
  const rpc = async (method, params = []) => {
    const response = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const { result, error } = await response.json();
    if (error) throw new Error(error.message);
    return result;
  };
  window.ethereum = {
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts") return [await rpc("shim_visitor")];
      if (method === "wallet_switchEthereumChain") return null;
      if (method === "eth_sendTransaction") return rpc("shim_send", params);
      throw new Error("The stand-in wallet does not do " + method);
    },
  };
`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, colorScheme: "light" });
const page = await context.newPage();
page.on("pageerror", (error) => console.log("pageerror", error.message));
await page.addInitScript(wallet);
const cdp = await context.newCDPSession(page);

cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const ts = metadata.timestamp ?? Date.now() / 1000;
  if (!t0) {
    t0 = ts;
    clockOffset = Date.now() / 1000 - ts;
  }
  fill(ts);
  last = Buffer.from(data, "base64");
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.querySelector('[data-field="prize"]')!.textContent !== "reading chain", null, { timeout: 60_000 });
await page.waitForFunction(() => document.querySelectorAll("[data-draws] button").length > 0, null, { timeout: 60_000 });
await page.evaluate(() => document.fonts.ready);
await hold(3000);
await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
await hold(300);

/** Photographs one part of the bond on a transparent ground. */
async function layer(name: string, selector: string, opaque = false) {
  await page.evaluate((sel) => {
    document.querySelectorAll<HTMLElement>(".bond__print, .bond__inner > *").forEach((el) => (el.style.visibility = "hidden"));
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => (el.style.visibility = "visible"));
  }, selector);
  await page.screenshot({ path: join(layerDir, `${name}.png`), omitBackground: !opaque });
}
await page.addStyleTag({ content: "html, body, .bond { background: transparent !important; }" });
await layer("print", ".bond__print", true);
await layer("wordmark", ".wordmark");
await layer("issue", ".bond__issue");
await layer("serial", ".bond__serial");
await layer("plain", ".bond__plain");
await layer("promise", ".bond__promise");
await layer("fields", ".fields");
await layer("foot", ".bond__foot, .bond__imprint");
await layer("postmark", ".postmark-slot");
await page.evaluate(() => {
  document.querySelectorAll<HTMLElement>(".bond__print, .bond__inner > *").forEach((el) => (el.style.visibility = ""));
});
await page.addStyleTag({ content: "html, body, .bond { background: var(--paper) !important; }" });

await page.addStyleTag({
  content: `
    html { scrollbar-width: none; scroll-behavior: auto !important; } ::-webkit-scrollbar { display: none; }
    #film-cursor { position: fixed; z-index: 10000; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none;
      transition: transform 0.8s cubic-bezier(.65,0,.35,1); filter: drop-shadow(0 3px 4px rgba(0,0,0,.35)); }
    #film-cursor.press svg { transform: scale(.82); } #film-cursor svg { transition: transform .12s; }
  `,
});
await page.evaluate(() => {
  const c = document.createElement("div");
  c.id = "film-cursor";
  c.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9.5-6.6 1.4L16 20l-2.6 1.3-3.6-7.3L4 18.6z" fill="#1d1b20" stroke="#f8ebcf" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  c.style.transform = `translate(${innerWidth * 0.72}px, ${innerHeight * 1.1}px)`;
  document.body.appendChild(c);
  // Eased page scroll, slower and smoother than the browser's own.
  (window as unknown as Record<string, unknown>).__glide = (y: number, ms: number) =>
    new Promise<void>((done) => {
      const y0 = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      const goal = Math.max(0, Math.min(max, y));
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / ms);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        scrollTo({ top: y0 + (goal - y0) * e, behavior: "instant" });
        if (p < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
});

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: VIEW.width * SCALE, maxHeight: VIEW.height * SCALE, everyNthFrame: 1 });
await hold(500);

/** Scrolls so the element's top sits `offset` px below the top of the viewport. */
async function glideTo(selector: string, ms = 1400, offset = 24) {
  await page.evaluate(
    async ([sel, dur, off]) => {
      const el = document.querySelector(sel as string)!;
      const y = el.getBoundingClientRect().top + scrollY - (off as number);
      await (window as unknown as { __glide: (y: number, ms: number) => Promise<void> }).__glide(y, dur as number);
    },
    [selector, ms, offset] as const,
  );
}

/** Moves the film cursor onto the element, presses, and clicks it. */
async function press(target: string, locator = page.locator(target).first()) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`nothing to click at ${target}`);
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.55;
  await page.evaluate(([px, py]) => {
    document.getElementById("film-cursor")!.style.transform = `translate(${px}px, ${py}px)`;
  }, [x, y] as const);
  await hold(900);
  await page.evaluate(() => document.getElementById("film-cursor")!.classList.add("press"));
  await page.mouse.click(x, y);
  await hold(160);
  await page.evaluate(() => document.getElementById("film-cursor")!.classList.remove("press"));
}

const started: Record<string, number> = {};
function begin(id: string) {
  mark(id);
  started[id] = Date.now();
}
/** Waits until `seconds` into the scene. */
async function until(id: string, seconds: number) {
  const left = seconds * 1000 - (Date.now() - started[id]);
  if (left > 0) await hold(left);
}

try {
  begin("hero");
  await until("hero", need("hero"));

  begin("counter");
  await glideTo("#counter", 1500, 20);
  await hold(500);
  await press("[data-connect]");
  mark("connected");
  await page.waitForSelector("[data-bond-submit]:not([hidden])");
  await hold(900);
  await page.locator("[data-bond-amount]").click({ clickCount: 3 });
  await page.keyboard.type(bond, { delay: 150 });
  await hold(500);
  await press("[data-bond-submit]");
  mark("bond");
  await page.waitForFunction(() => /^Bonded\./.test(document.querySelector("[data-status]")!.textContent ?? ""), null, { timeout: CHAIN_WAIT });
  mark("bonded");
  await until("counter", need("counter"));

  begin("register");
  await until("register", 2.6);
  await glideTo("#register", 1500, 24);
  await until("register", need("register"));

  begin("draw");
  await until("draw", spoken("draw", "anyone") - 0.9);
  await press("finish", page.getByRole("button", { name: /finish it/i }));
  mark("finish");
  await page.waitForFunction(() => ![...document.querySelectorAll("[data-draws] button")].some((b) => /finish/i.test(b.textContent ?? "")), null, { timeout: CHAIN_WAIT });
  mark("paid");
  await until("draw", need("draw"));

  begin("check");
  await hold(200);
  await press("check", page.getByRole("button", { name: /check it/i }).first());
  mark("checking");
  await page.waitForFunction(() => document.querySelectorAll("[data-checks] li").length >= 4, null, { timeout: CHAIN_WAIT });
  mark("checked");
  await until("check", need("check"));

  begin("exit");
  await glideTo("#counter", 1300, 20);
  await hold(300);
  await press("[data-unbond]");
  mark("unbond");
  await page.waitForFunction(() => /^Unbonding started/.test(document.querySelector("[data-status]")!.textContent ?? ""), null, { timeout: CHAIN_WAIT });
  mark("unbonded");
  await hold(3000); // The receipt, and the page refreshing around it.
  await until("exit", need("exit"));
  mark("end");
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  fill(Date.now() / 1000 - clockOffset);
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on("close", r));
  await browser.close();
  writeFileSync(
    join(outDir, "site.json"),
    JSON.stringify({ fps: FPS, width: VIEW.width * SCALE, height: VIEW.height * SCALE, seconds: written / FPS, marks }, null, 2) + "\n",
  );
  console.log(`\n${(written / FPS).toFixed(1)}s of footage`);
}
