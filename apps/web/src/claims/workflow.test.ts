import { workflows } from "@claimforge/api-client";
import { rolePermissions } from "@claimforge/api-client/fixtures";
import { describe, expect, test } from "vitest";

import type { ClaimStatus } from "./status";
import { mayMove, moveLabel, needsReason } from "./workflow";

const transitions = Object.entries(workflows.ClaimStatus.transitions).flatMap(([from, tos]) =>
  tos.map((to) => [from as ClaimStatus, to] as const),
);

describe("moveLabel", () => {
  test("every move the contract allows has its own words, unique from each status", () => {
    for (const [from] of transitions) {
      const labels = workflows.ClaimStatus.transitions[from].map((to) => moveLabel(from, to));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  test.each([
    ["closed", "in_progress", "Reopen"],
    ["cancelled", "new", "Reinstate"],
    ["on_hold", "in_progress", "Resume work"],
    ["new", "in_progress", "Start work"],
    ["completed", "closed", "Close"],
  ] as const)("%s → %s reads %j", (from, to, label) => {
    expect(moveLabel(from, to)).toBe(label);
  });
});

describe("needsReason", () => {
  test("follows the contract", () => {
    expect(needsReason("new", "on_hold")).toBe(true);
    expect(needsReason("closed", "in_progress")).toBe(true);
    expect(needsReason("new", "inspected")).toBe(false);
    expect(needsReason("completed", "closed")).toBe(false);
  });
});

describe("mayMove", () => {
  test("open claims take claims:write; closed and cancelled ones claims:reopen", () => {
    expect(mayMove(rolePermissions.adjuster, "new")).toBe(true);
    expect(mayMove(rolePermissions.technician, "new")).toBe(false);
    expect(mayMove(rolePermissions.adjuster, "closed")).toBe(false);
    expect(mayMove(rolePermissions.admin, "cancelled")).toBe(true);
  });
});
