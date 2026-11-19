import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { QueryParams, RequestBody } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { nextCursor } from "./pages";

type ContactsQuery = Omit<
  QueryParams<"/v1/organizations/{organization_id}/contacts", "get">,
  "cursor"
>;
type ContactCreate = RequestBody<"/v1/organizations/{organization_id}/contacts", "post">;
type ContactUpdate = RequestBody<
  "/v1/organizations/{organization_id}/contacts/{contact_id}",
  "patch"
>;

/**
 * The organization's address book, alphabetical, a page at a time: `q` matches names,
 * companies, emails and phone digits; `kind` narrows to one kind of contact.
 */
export function contactsQuery(api: ApiClient, organizationId: string, query: ContactsQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.contactList(organizationId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get("/v1/organizations/{organization_id}/contacts", {
        path: { organization_id: organizationId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

/** Pages of contacts; `allItems(data)` flattens them. */
export function useContacts(organizationId: string, query: ContactsQuery = {}) {
  return useInfiniteQuery(contactsQuery(useApi(), organizationId, query));
}

/** Add someone to the address book; every contact list refreshes. */
export function useCreateContact(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ContactCreate) =>
      api.post("/v1/organizations/{organization_id}/contacts", {
        path: { organization_id: organizationId },
        body,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts(organizationId) }),
  });
}

/**
 * Change a contact. Claims carry their contacts, so the organization's claims refresh
 * with the address book: a new phone number shows wherever the contact does.
 */
export function useUpdateContact(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, ...body }: ContactUpdate & { contactId: string }) =>
      api.patch("/v1/organizations/{organization_id}/contacts/{contact_id}", {
        path: { organization_id: organizationId, contact_id: contactId },
        body,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts(organizationId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.claims(organizationId) }),
      ]),
  });
}
