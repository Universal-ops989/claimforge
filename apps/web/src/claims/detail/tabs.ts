import type { Schema } from "@claimforge/api-client";
import { useMatches, useOutletContext } from "react-router";

export type Claim = Schema<"ClaimRead">;

/**
 * The claim page's tabs, in order. Each is a child route of `/:org/claims/:number`, at
 * `path` (`""` is the index); its route says which tab it is with `handle: { tab: id }`.
 */
export const CLAIM_TABS = [
  { id: "overview", path: "", label: "Overview" },
  { id: "rooms", path: "rooms", label: "Rooms" },
  { id: "photos", path: "photos", label: "Photos" },
  { id: "moisture", path: "moisture", label: "Moisture" },
  { id: "equipment", path: "equipment", label: "Equipment" },
  { id: "notes", path: "notes", label: "Notes" },
  { id: "tasks", path: "tasks", label: "Tasks" },
  { id: "timeline", path: "timeline", label: "Timeline" },
] as const;

export type ClaimTabId = (typeof CLAIM_TABS)[number]["id"];

/** The route `handle` that names a claim tab. */
export interface ClaimTabHandle {
  tab: ClaimTabId;
}

/** The tab the address is on: the matched route that names one. */
export function useCurrentClaimTab(): ClaimTabId {
  const named = useMatches()
    .map((match) => (match.handle as Partial<ClaimTabHandle> | undefined)?.tab)
    .find((tab) => tab !== undefined);
  return named ?? "overview";
}

/** The claim a tab is showing: the claim page loads it once, for every tab. */
export function useClaimOfPage(): Claim {
  return useOutletContext<Claim>();
}
