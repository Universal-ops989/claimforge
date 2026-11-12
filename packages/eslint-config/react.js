// @ts-check
import eslintReact from "@eslint-react/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import base from "./base.js";

/** Config for React packages and apps: base rules + React, hooks and a11y. */
export default tseslint.config(
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    ...eslintReact.configs["recommended-type-checked"],
  },
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ["**/*.stories.tsx", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },
);
