import type { Schema } from "@claimforge/api-client";
import type { BadgeTone } from "@claimforge/ui";

export type ClaimStatus = Schema<"ClaimStatus">;

/** Each status as people say it. */
export const STATUS_LABEL: Record<ClaimStatus, string> = {
  new: "New",
  inspected: "Inspected",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

/** How a status badge looks: attention for new work, calm for finished. */
export const STATUS_TONE: Record<ClaimStatus, BadgeTone> = {
  new: "info",
  inspected: "accent",
  in_progress: "accent",
  on_hold: "warning",
  completed: "success",
  closed: "neutral",
  cancelled: "neutral",
};

/** The statuses of claims still being worked, in lifecycle order. */
export const ACTIVE_STATUSES: ClaimStatus[] = ["new", "inspected", "in_progress", "on_hold"];
