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
