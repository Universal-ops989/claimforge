/**
 * The signed-in user, and signing in and out.
 *
 * Signing in as someone else must never show the previous user's data, even for a
 * moment, so every way in resets the cache and every way out removes it.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Tokens } from "../auth";
import type { ApiClient } from "../client";
import type { RequestBody } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";

/** `/v1/me` as query options, for `useQuery`, `prefetchQuery` or a router loader. */
export function meQuery(api: ApiClient) {
  return queryOptions({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => api.get("/v1/me", { signal }),
  });
}

/** The signed-in user and their organizations, with each role and permission list. */
export function useMe() {
  return useQuery(meQuery(useApi()));
}

type Credentials = RequestBody<"/v1/auth/login", "post">;
type Invitation = RequestBody<"/v1/invitations/accept", "post">;

/** Sign in. On success the cache starts over and active queries refetch as the new user. */
export function useLogin() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<Tokens, Error, Credentials>({
    mutationFn: (credentials) => api.login(credentials),
    onSuccess: () => queryClient.resetQueries(),
  });
}

/** Accept an invitation, which signs in (creating the account when it's new). */
export function useAcceptInvitation() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<Tokens, Error, Invitation>({
    mutationFn: (invitation) => api.acceptInvitation(invitation),
    onSuccess: () => queryClient.resetQueries(),
  });
}

/**
 * Sign out and drop every cached query. Signing out locally can't fail, so neither does
 * this. Call `queryClient.removeQueries()` from `onSessionExpired` for the same effect when
 * the session ends on its own.
 */
export function useLogout() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await queryClient.cancelQueries();
      await api.logout();
    },
    onSettled: () => {
      queryClient.removeQueries();
    },
  });
}
