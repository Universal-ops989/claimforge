/**
 * Query keys for everything the hooks cache.
 *
 * Keys nest, and TanStack Query matches by prefix, so the shape decides what one
 * invalidation reaches:
 *
 *     ["claimforge"]                                    everything
 *     ["claimforge", "me"]                              the signed-in user
 *     ["claimforge", "organizations", "list", query]    pages of organizations
 *     ["claimforge", "organizations", id]               one organization …
 *     ["claimforge", "organizations", id, "invitations"]  … and everything under it
 *     ["claimforge", "organizations", id, "claims", "list", query]
 *     ["claimforge", "organizations", id, "claims", "by-number", number]
 *     ["claimforge", "organizations", id, "claims", claimId]               one claim …
 *     ["claimforge", "organizations", id, "claims", claimId, "timeline", query]  … and its data
 *
 * Invalidating `queryKeys.organization(id)` therefore refreshes the organization and all
 * of its data; removing it on delete drops all of it.
 */
import type { QueryParams } from "../index";

const ROOT = "claimforge";

type OrganizationsQuery = Omit<QueryParams<"/v1/organizations", "get">, "cursor">;
type ClaimsQuery = Omit<QueryParams<"/v1/organizations/{organization_id}/claims", "get">, "cursor">;
type TimelineQuery = Omit<
  QueryParams<"/v1/organizations/{organization_id}/claims/{claim_id}/timeline", "get">,
  "cursor"
>;

export const queryKeys = {
  all: [ROOT] as const,
  me: () => [ROOT, "me"] as const,
  /** Every page of every organizations list (ids are uuids, never "list"). */
  organizationLists: () => [ROOT, "organizations", "list"] as const,
  organizationList: (query: OrganizationsQuery = {}) =>
    [...queryKeys.organizationLists(), query] as const,
  organization: (organizationId: string) => [ROOT, "organizations", organizationId] as const,
  invitations: (organizationId: string) =>
    [...queryKeys.organization(organizationId), "invitations"] as const,

  claims: (organizationId: string) =>
    [...queryKeys.organization(organizationId), "claims"] as const,
  /** Every page of every claims list in the organization. */
  claimLists: (organizationId: string) => [...queryKeys.claims(organizationId), "list"] as const,
  claimList: (organizationId: string, query: ClaimsQuery = {}) =>
    [...queryKeys.claimLists(organizationId), query] as const,
  claimByNumber: (organizationId: string, number: string) =>
    [...queryKeys.claims(organizationId), "by-number", number] as const,
  claim: (organizationId: string, claimId: string) =>
    [...queryKeys.claims(organizationId), claimId] as const,
  statusHistory: (organizationId: string, claimId: string) =>
    [...queryKeys.claim(organizationId, claimId), "status-history"] as const,
  timelines: (organizationId: string, claimId: string) =>
    [...queryKeys.claim(organizationId, claimId), "timeline"] as const,
  timeline: (organizationId: string, claimId: string, query: TimelineQuery = {}) =>
    [...queryKeys.timelines(organizationId, claimId), query] as const,
  /** A claim's structures, each with its rooms. */
  structures: (organizationId: string, claimId: string) =>
    [...queryKeys.claim(organizationId, claimId), "structures"] as const,
  /** One room, and later whatever is recorded in it. */
  room: (organizationId: string, claimId: string, roomId: string) =>
    [...queryKeys.claim(organizationId, claimId), "rooms", roomId] as const,
};
