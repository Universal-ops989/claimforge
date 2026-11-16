/**
 * A claim's documents: authorizations, correspondence, invoices, policies, ….
 *
 * Lists are newest first. A finished upload goes on top of the unfiltered lists; lists
 * filtered by category are refetched, since a change of category moves a document
 * between them.
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
import type { QueryParams, RequestBody, Schema } from "../index";
import { schemas } from "../zod.gen";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { editOrRefetch, nextCursor } from "./pages";
import { uploadFile, type FileFacts } from "./upload";

type Document = Schema<"DocumentRead">;

const DOCUMENTS = "/v1/organizations/{organization_id}/claims/{claim_id}/documents";
const DOCUMENT = `${DOCUMENTS}/{document_id}` as const;
const UPLOADS = "/v1/organizations/{organization_id}/claims/{claim_id}/document-uploads";

type DocumentsQuery = Omit<QueryParams<typeof DOCUMENTS, "get">, "cursor">;

// ─── Reading ─────────────────────────────────────────────────────────────────

export function documentsQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: DocumentsQuery = {},
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.documentList(organizationId, claimId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(DOCUMENTS, {
        path: { organization_id: organizationId, claim_id: claimId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

/** Pages of documents, newest first; `{ category: [...] }` narrows them. */
export function useDocuments(organizationId: string, claimId: string, query: DocumentsQuery = {}) {
  return useInfiniteQuery(documentsQuery(useApi(), organizationId, claimId, query));
}

export function documentQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  documentId: string,
) {
  return queryOptions({
    queryKey: queryKeys.document(organizationId, claimId, documentId),
    queryFn: ({ signal }) =>
      api.get(DOCUMENT, {
        path: { organization_id: organizationId, claim_id: claimId, document_id: documentId },
        signal,
      }),
  });
}

export function useDocument(organizationId: string, claimId: string, documentId: string) {
  return useQuery(documentQuery(useApi(), organizationId, claimId, documentId));
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

const filtered = (query: DocumentsQuery) => (query.category?.length ?? 0) > 0;

async function settle(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  document: Document,
  place: (documents: Document[], index: number) => Document[],
): Promise<void> {
  queryClient.setQueryData<Document>(
    queryKeys.document(organizationId, claimId, document.id),
    document,
  );
  await Promise.all([
    editOrRefetch(queryClient, queryKeys.documentLists(organizationId, claimId), filtered, place),
    queryClient.invalidateQueries({ queryKey: queryKeys.timelines(organizationId, claimId) }),
  ]);
}

// ─── Changing ────────────────────────────────────────────────────────────────

export type DocumentUpload = FileFacts<Schema<"DocumentType">> &
  Omit<RequestBody<typeof UPLOADS, "post">, "filename" | "content_type" | "size_bytes">;

/**
 * Upload a document: `mutate({ file, category?, title? })`. A file of a type the API
 * doesn't take, or an empty one, fails with `UploadError("invalid")` before any request.
 */
export function useUploadDocument(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const path = { organization_id: organizationId, claim_id: claimId };
  return useMutation({
    mutationFn: (document: DocumentUpload) =>
      uploadFile(api, document, {
        schema: schemas.DocumentUploadCreate,
        start: (body: RequestBody<typeof UPLOADS, "post">, signal) =>
          api.post(UPLOADS, { path, body, signal }),
        finish: (uploadId, signal) =>
          api.post(`${UPLOADS}/{upload_id}/complete`, {
            path: { ...path, upload_id: uploadId },
            signal,
          }),
      }),
    onSuccess: (created) =>
      settle(queryClient, organizationId, claimId, created, (documents, index) =>
        index === 0
          ? [created, ...documents.filter((document) => document.id !== created.id)]
          : documents,
      ),
  });
}

export interface DocumentChange {
  documentId: string;
  changes: RequestBody<typeof DOCUMENT, "patch">;
}

/** Retitle or recategorize a document. */
export function useUpdateDocument(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, changes }: DocumentChange) =>
      api.patch(DOCUMENT, {
        path: { organization_id: organizationId, claim_id: claimId, document_id: documentId },
        body: changes,
      }),
    onSuccess: (updated) =>
      settle(queryClient, organizationId, claimId, updated, (documents) =>
        documents.map((document) => (document.id === updated.id ? updated : document)),
      ),
  });
}

export function useDeleteDocument(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      api.delete(DOCUMENT, {
        path: { organization_id: organizationId, claim_id: claimId, document_id: documentId },
      }),
    onSuccess: async (_, documentId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.document(organizationId, claimId, documentId),
      });
      await Promise.all([
        editOrRefetch(
          queryClient,
          queryKeys.documentLists(organizationId, claimId),
          () => false, // a deleted document leaves every list
          (documents: Document[]) => documents.filter((document) => document.id !== documentId),
        ),
        queryClient.invalidateQueries({ queryKey: queryKeys.timelines(organizationId, claimId) }),
      ]);
    },
  });
}
