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
export { ApiProvider, useApi, type ApiProviderProps } from "./context";
export { queryKeys } from "./keys";
export { createQueryClient, MAX_RETRIES, shouldRetry } from "./query-client";
export { meQuery, useAcceptInvitation, useLogin, useLogout, useMe } from "./session";
