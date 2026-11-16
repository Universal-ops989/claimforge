/**
 * React Query hooks over the typed client: `@claimforge/api-client/react`.
 *
 *     const queryClient = createQueryClient();
 *     <QueryClientProvider client={queryClient}>
 *       <ApiProvider client={api}>…</ApiProvider>
 *     </QueryClientProvider>
 *
 * Each data hook has a matching `…Query(api, …)` returning query options, so router
 * loaders can prefetch exactly what the component will read.
 */
export {
  claimByNumberQuery,
  claimQuery,
  claimsQuery,
  statusHistoryQuery,
  timelineQuery,
  useAssignClaim,
  useChangeClaimStatus,
  useClaim,
  useClaimByNumber,
  useClaims,
  useClaimStatusHistory,
  useClaimTimeline,
  useCreateClaim,
  useUnassignClaim,
  useUpdateClaim,
} from "./claims";
export { ApiProvider, useApi, type ApiProviderProps } from "./context";
export { queryKeys } from "./keys";
export { createQueryClient, MAX_RETRIES, shouldRetry } from "./query-client";
export {
  invitationsQuery,
  organizationQuery,
  organizationsQuery,
  useCreateInvitation,
  useCreateOrganization,
  useDeleteOrganization,
  useInvitations,
  useOrganization,
  useOrganizations,
  useRevokeInvitation,
  useUpdateOrganization,
} from "./organizations";
export { allItems, nextCursor } from "./pages";
export { meQuery, useAcceptInvitation, useLogin, useLogout, useMe } from "./session";
