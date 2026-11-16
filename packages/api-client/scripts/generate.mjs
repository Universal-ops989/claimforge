// Generate TypeScript types from the API's committed OpenAPI contract.
//
//   pnpm --filter @claimforge/api-client generate   # write src/schema.gen.ts
//
// `just api-openapi` runs this after exporting the contract, so the two never drift.
// src/schema.test.ts fails when the committed file is stale.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

export const CONTRACT_PATH = fileURLToPath(
  new URL("../../../apps/api/openapi.json", import.meta.url),
);
export const OUTPUT_PATH = fileURLToPath(new URL("../src/schema.gen.ts", import.meta.url));

const HEADER = `// Generated from apps/api/openapi.json by scripts/generate.mjs. Do not edit.
// Regenerate with \`just api-openapi\` (or \`pnpm --filter @claimforge/api-client generate\`).

`;

/**
 * Render the contract as TypeScript source.
 *
 * @param {string} contractPath
 * @returns {Promise<string>}
 */
export async function render(contractPath = CONTRACT_PATH) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const ast = await openapiTS(contract, {
    // Trust the contract's `required` lists. Pydantic marks fields that always appear in
    // responses as required, while request fields with defaults stay optional; letting
    // defaults imply "present" would make callers send fields the API fills in itself.
    defaultNonNullable: false,
    // No progress or lint chatter: the API's own CI already validates the contract.
    silent: true,
  });
  return HEADER + astToString(ast);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await writeFile(OUTPUT_PATH, await render());
  console.warn(`wrote ${OUTPUT_PATH}`);
}
