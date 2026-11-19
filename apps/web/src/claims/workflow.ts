import { workflows } from "@claimforge/api-client";

import { READ_ONLY_STATUSES, type ClaimStatus } from "./status";

/**
 * A move from `from` to `to`, as people say it: "Put on hold", "Reopen". Where a claim
 * can go is the API's (`next_statuses`); this only names the moves.
 */
export function moveLabel(from: ClaimStatus, to: ClaimStatus): string {
  switch (to) {
    case "new":
      return from === "cancelled" ? "Reinstate" : "Move back to new";
    case "inspected":
      return from === "on_hold" ? "Resume as inspected" : "Mark as inspected";
    case "in_progress":
      if (from === "closed") return "Reopen";
      if (from === "on_hold") return "Resume work";
      if (from === "completed") return "Back to work";
      return "Start work";
    case "on_hold":
      return "Put on hold";
    case "completed":
      return "Mark as completed";
    case "closed":
      return "Close";
    case "cancelled":
      return "Cancel the claim";
  }
}

/** Whether the contract asks for a reason to move from `from` to `to` (`x-reason-required`). */
export function needsReason(from: ClaimStatus, to: ClaimStatus): boolean {
  const required: readonly ClaimStatus[] = workflows.ClaimStatus.reasonRequired[from];
  return required.includes(to);
}

/**
 * Whether someone with `permissions` may move a claim that is `from`: `claims:write`, and
 * `claims:reopen` to reopen a closed claim or reinstate a cancelled one.
 */
export function mayMove(permissions: readonly string[], from: ClaimStatus): boolean {
  return permissions.includes(READ_ONLY_STATUSES.includes(from) ? "claims:reopen" : "claims:write");
}
