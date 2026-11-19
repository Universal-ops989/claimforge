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

/** Statuses whose claims are read-only: the API refuses changes with `claim_locked`. */
export const READ_ONLY_STATUSES: ClaimStatus[] = ["closed", "cancelled"];

/** The statuses of claims still being worked, in lifecycle order. */
export const ACTIVE_STATUSES: ClaimStatus[] = ["new", "inspected", "in_progress", "on_hold"];

export type PropertyType = Schema<"PropertyType">;

/** Each property type as people say it. */
export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  residential: "Residential",
  multi_family: "Multi-family",
  commercial: "Commercial",
  industrial: "Industrial",
  other: "Other",
};

export type LossType = Schema<"LossType">;

/** Each loss type as people say it. */
export const LOSS_TYPE_LABEL: Record<LossType, string> = {
  water: "Water",
  fire: "Fire",
  smoke: "Smoke",
  mold: "Mold",
  wind: "Wind",
  hail: "Hail",
  storm: "Storm",
  flood: "Flood",
  sewage: "Sewage",
  impact: "Impact",
  vandalism: "Vandalism",
  other: "Other",
};
