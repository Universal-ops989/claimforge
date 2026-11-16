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
 *
 * Invalidating `queryKeys.organization(id)` therefore refreshes the organization and all
 * of its data; removing it on delete drops all of it.
 */
import type { QueryParams } from "../index";

const ROOT = "claimforge";

type OrganizationsQuery = Omit<QueryParams<"/v1/organizations", "get">, "cursor">;

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
};
