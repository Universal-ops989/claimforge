/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import pkg from "./package.json" with { type: "json" };

const externals = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];

export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      // Stable, readable class names: cf-Button-root-x1y2z
      generateScopedName: "cf-[name]-[local]-[hash:base64:4]",
    },
  },
  build: {
    lib: {
      // Separate entries so optional integrations (react-hook-form) are only
      // loaded by apps that import them.
      entry: { index: "src/index.ts", form: "src/form/index.ts" },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
      cssFileName: "claimforge-ui",
    },
    rollupOptions: {
      // Never bundle dependencies or their subpaths (react/jsx-runtime, radix-ui/...).
      external: (id) => externals.some((dep) => id === dep || id.startsWith(`${dep}/`)),
    },
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
