import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const forkDeployment = fileURLToPath(new URL("../keeper/fork/deployment.fork.json", import.meta.url));
const siteUrl = process.env.SITE_URL ?? "";

// `--mode fork` points the site at a local rehearsal instead of the live testnet.
// The relative base lets the build run from any path, such as a GitHub Pages project site.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [{ name: "site-url", transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", siteUrl) }],
  resolve: { alias: mode === "fork" ? { "./deployment.json": forkDeployment } : {} },
  server: { port: 5173, fs: { allow: [".."] } },
  build: { target: "es2022" },
}));
