import type { Schema } from "@claimforge/api-client";
import type { BadgeTone } from "@claimforge/ui";

export type EstimateStatus = Schema<"EstimateStatus">;
export type Estimate = Schema<"EstimateRead">;
export type Line = Schema<"LineRead">;

export const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const ESTIMATE_STATUS_TONE: Record<EstimateStatus, BadgeTone> = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
  rejected: "danger",
};

/** Dollars from the API's decimal string: "1234.5" is "$1,234.50". */
export function money(amount: string): string {
  return Number(amount).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** A rate from the API's decimal string: "8.250" is "8.25%". */
export function percent(rate: string): string {
  return `${Number(rate).toLocaleString(undefined, { maximumFractionDigits: 3 })}%`;
}

/** A quantity from the API's decimal string, without trailing zeros: "24.00" is "24". */
export function quantity(amount: string): string {
  return Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * A decimal as typed, checked for the API: up to `places` decimals, in range, written
 * plainly ("1,200" and "$85" are taken as 1200 and 85). The API's string, or what's wrong.
 */
export function parseDecimal(
  text: string,
  { places, max, what }: { places: number; max: number; what: string },
): { value: string } | { problem: string } {
  const plain = text.trim().replace(/[$,%\s]/g, "");
  if (!plain) return { problem: `Enter the ${what}.` };
  if (!new RegExp(`^\\d+(\\.\\d{0,${String(places)}})?$`).test(plain)) {
    return {
      problem:
        places === 0
          ? `Enter a whole number for the ${what}.`
          : `Enter the ${what} to ${places === 2 ? "the hundredth" : `${String(places)} decimals`} at most.`,
    };
  }
  if (Number(plain) > max) return { problem: `The ${what} can be up to ${max.toLocaleString()}.` };
  return { value: plain.endsWith(".") ? plain.slice(0, -1) : plain };
}

/** What a line comes to, as the API works it out: quantity × unit price, to the cent. */
export function lineTotal(quantityText: string, unitPrice: string): string {
  const cents = Math.round(Number(quantityText) * Math.round(Number(unitPrice) * 100));
  return (cents / 100).toFixed(2);
}
