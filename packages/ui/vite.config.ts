/// <reference types="vitest/config" />
import path from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
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
    projects: [
      {
        // Fast component tests in jsdom.
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          css: { modules: { classNameStrategy: "non-scoped" } },
        },
      },
      {
        // Every story rendered in real Chromium: play functions and axe checks.
        extends: true,
        plugins: [storybookTest({ configDir: path.join(import.meta.dirname, ".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
          // Explicit IPv4: on some systems "localhost" resolves differently for the
          // test server and the browser, which then can't connect.
          api: { host: "127.0.0.1" },
        },
      },
    ],
  },
});
