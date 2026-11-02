import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const forkDeployment = fileURLToPath(new URL("../keeper/fork/deployment.fork.json", import.meta.url));

// `--mode fork` points the site at a local rehearsal instead of the live testnet.
export default defineConfig(({ mode }) => ({
  resolve: { alias: mode === "fork" ? { "./deployment.json": forkDeployment } : {} },
  server: { port: 5173, fs: { allow: [".."] } },
  build: { target: "es2022" },
}));
