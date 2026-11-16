import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import { OUTPUT_PATH, render } from "../scripts/generate.mjs";

describe("schema.gen.ts", () => {
  test("matches the committed OpenAPI contract", { timeout: 30_000 }, async () => {
    const committed = await readFile(OUTPUT_PATH, "utf8");
    const fresh = await render();
    // A failure here means apps/api/openapi.json changed without regenerating the types:
    // run `just api-openapi` and commit both files.
    expect(committed === fresh, "schema.gen.ts is stale: run `just api-openapi`").toBe(true);
  });
});
