import type { RequestBody } from "@claimforge/api-client";
import type { FieldErrors, Resolver } from "react-hook-form";

import type { LossType } from "../status";

/**
 * A claim being written. Every field is a string while it's typed (a select's "" is
 * "not chosen"); `toClaimCreate` turns it into the API's body.
 */
export interface ClaimDraft {
  property: {
    line1: string;
    line2: string;
    city: string;
    region: string;
    postal_code: string;
    property_type: "" | "residential" | "multi_family" | "commercial" | "industrial" | "other";
    year_built: string;
    access_notes: string;
  };
  loss: {
    loss_type: "" | LossType;
    /** `YYYY-MM-DD`, or "" when not known yet. */
    loss_date: string;
    description: string;
    carrier_name: string;
    policy_number: string;
    carrier_claim_number: string;
  };
}

export const EMPTY_DRAFT: ClaimDraft = {
  property: {
    line1: "",
    line2: "",
    city: "",
    region: "",
    postal_code: "",
    property_type: "residential",
    year_built: "",
    access_notes: "",
  },
  loss: {
    loss_type: "",
    loss_date: "",
    description: "",
    carrier_name: "",
    policy_number: "",
    carrier_claim_number: "",
  },
};

/** A field's path in the draft, e.g. `"property.line1"`. */
export type DraftField =
  `property.${keyof ClaimDraft["property"]}` | `loss.${keyof ClaimDraft["loss"]}`;

/** Fields the contract caps, and how long each may be. */
const LIMITS: Partial<Record<DraftField, number>> = {
  "property.line1": 200,
  "property.line2": 100,
  "property.city": 100,
  "property.region": 100,
  "property.postal_code": 16,
  "property.access_notes": 2000,
  "loss.description": 10000,
  "loss.carrier_name": 200,
  "loss.policy_number": 64,
  "loss.carrier_claim_number": 64,
};

/** The earliest year the API takes for when a building went up. */
export const EARLIEST_YEAR_BUILT = 1600;

/**
 * What's wrong with `draft`, field by field, in words. `today` (`YYYY-MM-DD`) bounds the
 * date of loss and `thisYear` the year built. These are the checks worth doing before
 * asking; the API still has the last word.
 */
export function draftProblems(
  draft: ClaimDraft,
  today: string,
  thisYear: number,
): Partial<Record<DraftField, string>> {
  const problems: Partial<Record<DraftField, string>> = {};
  const { property, loss } = draft;

  if (!property.line1.trim()) problems["property.line1"] = "Enter the street address.";
  if (!property.city.trim()) problems["property.city"] = "Enter the city.";
  if (property.year_built.trim()) {
    const year = Number(property.year_built);
    if (!Number.isInteger(year) || year < EARLIEST_YEAR_BUILT || year > thisYear) {
      problems["property.year_built"] =
        `Enter a year from ${String(EARLIEST_YEAR_BUILT)} to ${String(thisYear)}.`;
    }
  }
  if (!loss.loss_type) problems["loss.loss_type"] = "Choose what caused the damage.";
  if (loss.loss_date && loss.loss_date > today) {
    problems["loss.loss_date"] = "The date of loss can't be in the future.";
  }

  for (const [field, limit] of Object.entries(LIMITS) as [DraftField, number][]) {
    const [section, name] = field.split(".") as ["property" | "loss", string];
    const value = (draft[section] as Record<string, string>)[name] ?? "";
    if (value.trim().length > limit) {
      problems[field] = `Keep this to ${String(limit)} characters or fewer.`;
    }
  }
  return problems;
}

/** Today in the user's time zone, as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** react-hook-form's resolver for the draft: `draftProblems`, in its error shape. */
export const draftResolver: Resolver<ClaimDraft> = (values) => {
  const now = new Date();
  const problems = draftProblems(values, localToday(now), now.getFullYear());
  const errors: FieldErrors<ClaimDraft> = {};
  for (const [field, message] of Object.entries(problems)) {
    const [section, name] = field.split(".") as ["property" | "loss", string];
    const group = (errors[section] ?? {}) as Record<string, { type: string; message: string }>;
    group[name] = { type: "validate", message };
    (errors as Record<string, unknown>)[section] = group;
  }
  return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} };
};

type ClaimCreate = RequestBody<"/v1/organizations/{organization_id}/claims", "post">;

/** Trimmed text, or `undefined` when there's none, so blanks aren't sent as "". */
const text = (value: string) => value.trim() || undefined;

/** The API's body for a checked draft: the claim with its property inline. */
export function toClaimCreate(draft: ClaimDraft): ClaimCreate {
  const { property, loss } = draft;
  const year = property.year_built.trim();
  return {
    loss_type: loss.loss_type || "other",
    loss_date: loss.loss_date || undefined,
    description: text(loss.description),
    carrier_name: text(loss.carrier_name),
    policy_number: text(loss.policy_number),
    carrier_claim_number: text(loss.carrier_claim_number),
    property: {
      address: {
        line1: property.line1.trim(),
        line2: text(property.line2),
        city: property.city.trim(),
        region: text(property.region),
        postal_code: text(property.postal_code),
      },
      property_type: property.property_type || undefined,
      year_built: year ? Number(year) : undefined,
      access_notes: text(property.access_notes),
    },
  };
}

/**
 * The draft field an API error points at: its `loc` (`["body", "property", "address",
 * "line1"]`) read back into the form, or `null` when it names nothing the form shows.
 */
export function fieldFor(loc: readonly (string | number)[]): DraftField | null {
  const [where, ...path] = loc;
  if (where !== "body") return null;
  if (path[0] === "property") {
    const name = path[1] === "address" ? path[2] : path[1];
    const field = `property.${String(name)}`;
    return field in FIELD_NAMES ? (field as DraftField) : null;
  }
  const field = `loss.${String(path[0])}`;
  return field in FIELD_NAMES ? (field as DraftField) : null;
}

const FIELD_NAMES: Record<DraftField, true> = {
  "property.line1": true,
  "property.line2": true,
  "property.city": true,
  "property.region": true,
  "property.postal_code": true,
  "property.property_type": true,
  "property.year_built": true,
  "property.access_notes": true,
  "loss.loss_type": true,
  "loss.loss_date": true,
  "loss.description": true,
  "loss.carrier_name": true,
  "loss.policy_number": true,
  "loss.carrier_claim_number": true,
};
