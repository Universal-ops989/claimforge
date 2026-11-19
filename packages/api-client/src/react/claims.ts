/**
 * Claims: lists, one claim (by id or by number), its status workflow, history, timeline
 * and assignments.
 *
 * A claim is cached twice, under its id and under its number (`2026-00042`, what URLs
 * and people use), and every change writes both. Fetching by number also fills the id
 * entry, so the mutations below, which all take the id, find the claim either way.
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
import { isApiError } from "../errors";
import type { QueryParams, RequestBody, Schema } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { nextCursor } from "./pages";

type Claim = Schema<"ClaimRead">;
type ClaimsQuery = Omit<QueryParams<"/v1/organizations/{organization_id}/claims", "get">, "cursor">;
type TimelineQuery = Omit<
  QueryParams<"/v1/organizations/{organization_id}/claims/{claim_id}/timeline", "get">,
  "cursor"
>;
type StatusChange = RequestBody<
  "/v1/organizations/{organization_id}/claims/{claim_id}/status",
  "post"
>;

// ─── Reading ─────────────────────────────────────────────────────────────────

/** Claims in an organization, a page at a time, filtered and sorted by `query`. */
export function claimsQuery(api: ApiClient, organizationId: string, query: ClaimsQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.claimList(organizationId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get("/v1/organizations/{organization_id}/claims", {
        path: { organization_id: organizationId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

/** Pages of claim summaries; `allItems(data)` flattens them. */
export function useClaims(organizationId: string, query: ClaimsQuery = {}) {
  return useInfiniteQuery(claimsQuery(useApi(), organizationId, query));
}

export function claimQuery(api: ApiClient, organizationId: string, claimId: string) {
  return queryOptions({
    queryKey: queryKeys.claim(organizationId, claimId),
    queryFn: ({ signal }) =>
      api.get("/v1/organizations/{organization_id}/claims/{claim_id}", {
        path: { organization_id: organizationId, claim_id: claimId },
        signal,
      }),
  });
}

export function useClaim(organizationId: string, claimId: string) {
  return useQuery(claimQuery(useApi(), organizationId, claimId));
}

/** A claim by its number. The answer is cached under its id too. */
export function claimByNumberQuery(api: ApiClient, organizationId: string, number: string) {
  return queryOptions({
    queryKey: queryKeys.claimByNumber(organizationId, number),
    queryFn: async ({ client, signal }) => {
      const claim = await api.get("/v1/organizations/{organization_id}/claims/by-number/{number}", {
        path: { organization_id: organizationId, number },
        signal,
      });
      client.setQueryData<Claim>(queryKeys.claim(organizationId, claim.id), claim);
      return claim;
    },
  });
}

export function useClaimByNumber(organizationId: string, number: string) {
  return useQuery(claimByNumberQuery(useApi(), organizationId, number));
}

/** Every status change, oldest first. */
export function statusHistoryQuery(api: ApiClient, organizationId: string, claimId: string) {
  return queryOptions({
    queryKey: queryKeys.statusHistory(organizationId, claimId),
    queryFn: ({ signal }) =>
      api.get("/v1/organizations/{organization_id}/claims/{claim_id}/status-history", {
        path: { organization_id: organizationId, claim_id: claimId },
        signal,
      }),
  });
}

export function useClaimStatusHistory(organizationId: string, claimId: string) {
  return useQuery(statusHistoryQuery(useApi(), organizationId, claimId));
}

/** What happened on a claim, newest first, a page at a time. */
export function timelineQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: TimelineQuery = {},
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.timeline(organizationId, claimId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get("/v1/organizations/{organization_id}/claims/{claim_id}/timeline", {
        path: { organization_id: organizationId, claim_id: claimId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useClaimTimeline(
  organizationId: string,
  claimId: string,
  query: TimelineQuery = {},
) {
  return useInfiniteQuery(timelineQuery(useApi(), organizationId, claimId, query));
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

function cachedClaim(queryClient: QueryClient, organizationId: string, claimId: string) {
  return queryClient.getQueryData<Claim>(queryKeys.claim(organizationId, claimId));
}

/** Put a claim the API just returned under both its keys. */
function writeClaim(queryClient: QueryClient, organizationId: string, claim: Claim): void {
  queryClient.setQueryData<Claim>(queryKeys.claim(organizationId, claim.id), claim);
  queryClient.setQueryData<Claim>(queryKeys.claimByNumber(organizationId, claim.number), claim);
}

/** Edit a cached claim in place, under both keys. Nothing cached, nothing to edit. */
function editClaim(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  edit: (claim: Claim) => Claim,
): void {
  const claim = cachedClaim(queryClient, organizationId, claimId);
  if (claim) {
    writeClaim(queryClient, organizationId, edit(claim));
  }
}

/**
 * Refetch what a change on one claim makes stale besides the claim itself: lists show
 * summaries of it, and the timeline (plus whatever else is named) gained an entry.
 */
async function refreshAround(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  ...also: (readonly unknown[])[]
): Promise<void> {
  await Promise.all(
    [
      queryKeys.claimLists(organizationId),
      queryKeys.timelines(organizationId, claimId),
      ...also,
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

// ─── Changing ────────────────────────────────────────────────────────────────

/** Open a claim, with a new property or an existing one. */
export function useCreateClaim(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<"/v1/organizations/{organization_id}/claims", "post">) =>
      api.post("/v1/organizations/{organization_id}/claims", {
        path: { organization_id: organizationId },
        body,
      }),
    onSuccess: async (created) => {
      writeClaim(queryClient, organizationId, created);
      await queryClient.invalidateQueries({ queryKey: queryKeys.claimLists(organizationId) });
    },
  });
}

export function useUpdateClaim(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      body: RequestBody<"/v1/organizations/{organization_id}/claims/{claim_id}", "patch">,
    ) =>
      api.patch("/v1/organizations/{organization_id}/claims/{claim_id}", {
        path: { organization_id: organizationId, claim_id: claimId },
        body,
      }),
    onSuccess: async (updated) => {
      writeClaim(queryClient, organizationId, updated);
      await refreshAround(queryClient, organizationId, claimId);
    },
  });
}

/**
 * Move a claim along its workflow (`claim.next_statuses` says where it can go).
 *
 * Unless the change says otherwise, it carries the status this client has cached as
 * `expected_status`: if someone else moved the claim in the meantime, the API refuses
 * with 409 `status_changed` instead of acting on what the user no longer sees, and the
 * claim and its lists are refetched so the screen catches up.
 */
export function useChangeClaimStatus(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: StatusChange) => {
      const seen = cachedClaim(queryClient, organizationId, claimId)?.status;
      return api.post("/v1/organizations/{organization_id}/claims/{claim_id}/status", {
        path: { organization_id: organizationId, claim_id: claimId },
        body: seen === undefined ? change : { expected_status: seen, ...change },
      });
    },
    onSuccess: async (moved) => {
      writeClaim(queryClient, organizationId, moved);
      await refreshAround(
        queryClient,
        organizationId,
        claimId,
        queryKeys.statusHistory(organizationId, claimId),
      );
    },
    onError: async (error) => {
      if (isApiError(error, "status_changed")) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.claims(organizationId) });
      }
    },
  });
}

type Assignment = RequestBody<
  "/v1/organizations/{organization_id}/claims/{claim_id}/assignments",
  "post"
>;

/**
 * Put someone on a claim in a role (one role per person). A claim has one adjuster: a new
 * one replaces the last, in the cache as the API does it.
 */
export function useAssignClaim(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Assignment) =>
      api.post("/v1/organizations/{organization_id}/claims/{claim_id}/assignments", {
        path: { organization_id: organizationId, claim_id: claimId },
        body,
      }),
    onSuccess: async (assignment) => {
      editClaim(queryClient, organizationId, claimId, (claim) => ({
        ...claim,
        assignments: [
          ...claim.assignments.filter(
            (a) =>
              a.user.id !== assignment.user.id &&
              !(assignment.role === "adjuster" && a.role === "adjuster"),
          ),
          assignment,
        ],
      }));
      await refreshAround(queryClient, organizationId, claimId);
    },
  });
}

// ─── Contacts on a claim ─────────────────────────────────────────────────────

type ContactLink = RequestBody<
  "/v1/organizations/{organization_id}/claims/{claim_id}/contacts",
  "post"
>;
type ContactLinkChange = RequestBody<
  "/v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}",
  "patch"
>;
type ClaimContact = Schema<"ClaimContactRead">;

/**
 * `claim` with `link` in place (or added at the end). A claim has one primary contact:
 * a primary link demotes the others, as the API does.
 */
function withContact(claim: Claim, link: ClaimContact): Claim {
  const others = claim.contacts.map((c) =>
    c.contact.id === link.contact.id ? link : link.is_primary ? { ...c, is_primary: false } : c,
  );
  const known = claim.contacts.some((c) => c.contact.id === link.contact.id);
  return { ...claim, contacts: known ? others : [...others, link] };
}

/** Link an address-book contact to a claim, in a role. */
export function useLinkContact(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ContactLink) =>
      api.post("/v1/organizations/{organization_id}/claims/{claim_id}/contacts", {
        path: { organization_id: organizationId, claim_id: claimId },
        body,
      }),
    onSuccess: async (link) => {
      editClaim(queryClient, organizationId, claimId, (claim) => withContact(claim, link));
      await refreshAround(queryClient, organizationId, claimId);
    },
  });
}

/** Change a linked contact's role on the claim, or make them (or stop them being) primary. */
export function useUpdateContactLink(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, ...body }: ContactLinkChange & { contactId: string }) =>
      api.patch("/v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}", {
        path: { organization_id: organizationId, claim_id: claimId, contact_id: contactId },
        body,
      }),
    onSuccess: async (link) => {
      editClaim(queryClient, organizationId, claimId, (claim) => withContact(claim, link));
      await refreshAround(queryClient, organizationId, claimId);
    },
  });
}

/** Take a contact off a claim (they stay in the address book). Undone if refused. */
export function useUnlinkContact(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) =>
      api.delete("/v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}", {
        path: { organization_id: organizationId, claim_id: claimId, contact_id: contactId },
      }),
    onMutate: async (contactId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.claim(organizationId, claimId) });
      const before = cachedClaim(queryClient, organizationId, claimId);
      editClaim(queryClient, organizationId, claimId, (claim) => ({
        ...claim,
        contacts: claim.contacts.filter((c) => c.contact.id !== contactId),
      }));
      return { before };
    },
    onError: (_error, _contactId, context) => {
      if (context?.before) {
        writeClaim(queryClient, organizationId, context.before);
      }
    },
    onSettled: () => refreshAround(queryClient, organizationId, claimId),
  });
}

/** Take someone off a claim. They disappear at once and come back if the API refuses. */
export function useUnassignClaim(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete("/v1/organizations/{organization_id}/claims/{claim_id}/assignments/{user_id}", {
        path: { organization_id: organizationId, claim_id: claimId, user_id: userId },
      }),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.claim(organizationId, claimId) });
      const before = cachedClaim(queryClient, organizationId, claimId);
      editClaim(queryClient, organizationId, claimId, (claim) => ({
        ...claim,
        assignments: claim.assignments.filter((a) => a.user.id !== userId),
      }));
      return { before };
    },
    onError: (_error, _userId, context) => {
      if (context?.before) {
        writeClaim(queryClient, organizationId, context.before);
      }
    },
    onSettled: () => refreshAround(queryClient, organizationId, claimId),
  });
}
