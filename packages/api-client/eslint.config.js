import base from "@claimforge/eslint-config/base";
import globals from "globals";

export default [
  ...base,
  { ignores: ["dist/**"] },
  // Build scripts run in Node.
  { files: ["scripts/**"], languageOptions: { globals: globals.node } },
];
