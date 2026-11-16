/**
 * Organizations and their invitations.
 *
 * After each change the cache is brought in line without waiting for a refetch where the
 * answer already says what changed, and refetched where it can't: `/v1/me` lists each
 * membership's organization by name, so creating, renaming or deleting one refreshes it.
 */
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { QueryParams, RequestBody } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { nextCursor } from "./pages";

type OrganizationsQuery = Omit<QueryParams<"/v1/organizations", "get">, "cursor">;

// ─── Organizations ───────────────────────────────────────────────────────────

/** The organizations the user belongs to, a page at a time. */
export function organizationsQuery(api: ApiClient, query: OrganizationsQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.organizationList(query),
    queryFn: ({ pageParam, signal }) =>
      api.get("/v1/organizations", { query: { ...query, cursor: pageParam }, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

/** Pages of organizations; `allItems(data)` flattens them, `fetchNextPage()` loads more. */
export function useOrganizations(query: OrganizationsQuery = {}) {
  return useInfiniteQuery(organizationsQuery(useApi(), query));
}

export function organizationQuery(api: ApiClient, organizationId: string) {
  return queryOptions({
    queryKey: queryKeys.organization(organizationId),
    queryFn: ({ signal }) =>
      api.get("/v1/organizations/{organization_id}", {
        path: { organization_id: organizationId },
        signal,
      }),
  });
}

export function useOrganization(organizationId: string) {
  return useQuery(organizationQuery(useApi(), organizationId));
}

/** Lists and `/v1/me` both show organizations; refresh them after any change. */
async function refreshListings(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.organizationLists() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
  ]);
}

/** Create an organization; the creator becomes its owner. */
export function useCreateOrganization() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<"/v1/organizations", "post">) =>
      api.post("/v1/organizations", { body }),
    onSuccess: async (created) => {
      queryClient.setQueryData(organizationQuery(api, created.id).queryKey, created);
      await refreshListings(queryClient);
    },
  });
}

export function useUpdateOrganization(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<"/v1/organizations/{organization_id}", "patch">) =>
      api.patch("/v1/organizations/{organization_id}", {
        path: { organization_id: organizationId },
        body,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(organizationQuery(api, organizationId).queryKey, updated);
      await refreshListings(queryClient);
    },
  });
}

/** Delete an organization (soft delete) and drop everything cached under it. */
export function useDeleteOrganization() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) =>
      api.delete("/v1/organizations/{organization_id}", {
        path: { organization_id: organizationId },
      }),
    onSuccess: async (_, organizationId) => {
      const everything = { queryKey: queryKeys.organization(organizationId) };
      await queryClient.cancelQueries(everything);
      queryClient.removeQueries(everything);
      await refreshListings(queryClient);
    },
  });
}

// ─── Invitations ─────────────────────────────────────────────────────────────

/** Pending invitations, newest first. */
export function invitationsQuery(api: ApiClient, organizationId: string) {
  return queryOptions({
    queryKey: queryKeys.invitations(organizationId),
    queryFn: ({ signal }) =>
      api.get("/v1/organizations/{organization_id}/invitations", {
        path: { organization_id: organizationId },
        signal,
      }),
  });
}

export function useInvitations(organizationId: string) {
  return useQuery(invitationsQuery(useApi(), organizationId));
}

/** Invite someone. The new invitation shows at the top at once, then the list refreshes. */
export function useCreateInvitation(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { queryKey } = invitationsQuery(api, organizationId);
  return useMutation({
    mutationFn: (body: RequestBody<"/v1/organizations/{organization_id}/invitations", "post">) =>
      api.post("/v1/organizations/{organization_id}/invitations", {
        path: { organization_id: organizationId },
        body,
      }),
    onSuccess: async (created) => {
      queryClient.setQueryData(queryKey, (pending) =>
        pending
          ? [created, ...pending.filter((invitation) => invitation.id !== created.id)]
          : pending,
      );
      await queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Revoke an invitation. It disappears at once and comes back if the API refuses. */
export function useRevokeInvitation(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { queryKey } = invitationsQuery(api, organizationId);
  return useMutation({
    mutationFn: (invitationId: string) =>
      api.delete("/v1/organizations/{organization_id}/invitations/{invitation_id}", {
        path: { organization_id: organizationId, invitation_id: invitationId },
      }),
    onMutate: async (invitationId) => {
      await queryClient.cancelQueries({ queryKey });
      const before = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (pending) =>
        pending?.filter((invitation) => invitation.id !== invitationId),
      );
      return { before };
    },
    onError: (_error, _invitationId, context) => {
      if (context?.before) {
        queryClient.setQueryData(queryKey, context.before);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
