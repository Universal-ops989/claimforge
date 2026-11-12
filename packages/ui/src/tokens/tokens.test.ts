import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { tokens } from "./tokens";

const css = ["primitives.css", "semantic.css"]
  .map((file) => readFileSync(resolve(import.meta.dirname, file), "utf8"))
  .join("\n");

const defined = new Set([...css.matchAll(/(--cf-[\w-]+)\s*:/g)].map((m) => m[1]));

describe("tokens", () => {
  const references = Object.values(tokens).flatMap((group) => Object.values(group));

  it.each(references)("%s is defined in CSS", (reference) => {
    const name = /var\((--cf-[\w-]+)\)/.exec(reference)?.[1];
    expect(defined).toContain(name);
  });
});
