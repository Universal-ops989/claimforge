/// <reference types="vitest/config" />
import { rm } from "node:fs/promises";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * `public/mockServiceWorker.js` serves the mock API in development (`VITE_API_MOCK=true`);
 * production builds don't use it, so it's dropped from their output.
 */
function dropMockWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "claimforge:drop-mock-worker",
    apply: "build",
    configResolved(resolved) {
      outDir = path.resolve(resolved.root, resolved.build.outDir);
    },
    async closeBundle() {
      if (process.env.VITE_API_MOCK !== "true") {
        await rm(path.join(outDir, "mockServiceWorker.js"), { force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), dropMockWorker()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { sourcemap: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
