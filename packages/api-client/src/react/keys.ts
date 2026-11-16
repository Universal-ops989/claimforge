/**
 * Query keys for everything the hooks cache.
 *
 * Keys nest, and TanStack Query matches by prefix, so the shape decides what one
 * invalidation reaches:
 *
 *     ["claimforge"]                                    everything
 *     ["claimforge", "me"]                              the signed-in user
 *     ["claimforge", "organizations", id]               one organization …
 *     ["claimforge", "organizations", id, "invitations"]  … and everything under it
 *
 * Invalidating `queryKeys.organization(id)` therefore refreshes the organization and all
 * of its data; removing it on delete drops all of it.
 */
const ROOT = "claimforge";

export const queryKeys = {
  all: [ROOT] as const,
  me: () => [ROOT, "me"] as const,
  organization: (organizationId: string) => [ROOT, "organizations", organizationId] as const,
};
