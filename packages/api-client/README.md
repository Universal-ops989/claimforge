# @claimforge/api-client

Typed access to the ClaimForge API. The types are generated from the API's committed
OpenAPI contract (`apps/api/openapi.json`), so the frontends and the API share a
single definition of every request and response.

## Types

```ts
import type {
  CursorPage,
  Problem,
  QueryParams,
  RequestBody,
  ResponseBody,
  Schema,
} from "@claimforge/api-client";

type Claim = Schema<"ClaimRead">;

type ClaimsPath = "/v1/organizations/{organization_id}/claims";
type ClaimFilters = QueryParams<ClaimsPath, "get">; // status, q, sort, limit, cursor…
type NewClaim = RequestBody<ClaimsPath, "post">; // Schema<"ClaimCreate">
type Claims = ResponseBody<ClaimsPath, "get">; // CursorPage<Schema<"ClaimSummary">>
type Invalid = ResponseBody<ClaimsPath, "post", 422>; // Problem
```

| Helper                  | Gives                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| `Schema<Name>`          | A named schema from the contract                                 |
| `MethodOf<Path>`        | The methods a path supports                                      |
| `PathParams<Path, M>`   | Path parameters                                                  |
| `QueryParams<Path, M>`  | Query parameters                                                 |
| `RequestBody<Path, M>`  | The JSON request body                                            |
| `ResponseBody<Path, M>` | The success body (`undefined` for 204); pass a status for others |
| `CursorPage<Item>`      | One page of any paginated list                                   |
| `Problem`               | The body of every error response (RFC 9457)                      |

The raw generated `paths`, `operations` and `components` are exported too.

## Calls

```ts
import { createApiClient, isApiError, raw } from "@claimforge/api-client";

const api = createApiClient({ baseUrl: "https://api.example.com" });

const claims = await api.get("/v1/organizations/{organization_id}/claims", {
  path: { organization_id },
  query: { status: ["new", "in_progress"], limit: 25 }, // arrays repeat the key
});

try {
  await api.patch("/v1/organizations/{organization_id}/claims/{claim_id}", {
    path: { organization_id, claim_id },
    body: { carrier_name: "Lone Star Mutual" },
  });
} catch (error) {
  if (isApiError(error, "claim_locked")) {
    // error.status, error.problem, error.fieldErrors (422)
  }
}

// Non-JSON bodies say what they are.
await api.post("/v1/organizations/{organization_id}/price-lists/{list_id}/import", {
  path: { organization_id, list_id },
  body: raw(csvText, "text/csv"),
});

// request() also returns the status and headers: reports answer 202 with Location
// and Retry-After.
const { data: job, headers } = await api.request("post", reportsPath, {
  path: { organization_id, claim_id },
  body: { kind: "photo_report" },
});
```

- Each method accepts only the paths that support it, and `path`, `query` and `body`
  are checked against the contract. A 204 resolves to `undefined`.
- Non-2xx answers throw `ApiError` with the RFC 9457 `problem`. A gateway page or other
  non-problem answer gets a synthesized problem with code `unexpected_response`.
- No answer at all throws `NetworkError` (the `fetch` failure is its `cause`).
- Pass `signal` to cancel; the call then rejects with the abort reason, untouched.

## Sessions

```ts
import { createApiClient, memoryTokenStore, webLock } from "@claimforge/api-client";

const api = createApiClient({
  baseUrl,
  auth: {
    tokens: memoryTokenStore(), // or any { get, set }, sync or async
    lock: webLock(), // one refresh across tabs that share the store
    onSessionExpired: () => navigate("/login"),
  },
});

await api.login({ email, password }); // keeps the tokens
await api.get("/v1/me"); // sent with the access token
await api.logout(); // forgets them, then revokes the session
```

Refresh tokens rotate, and the API revokes the whole session when one is presented
twice. So the client exchanges each refresh token at most once:

- The access token is refreshed 30 seconds before it expires (`refreshMargin`), and once
  more on a 401 `authentication_required`, after which the call is retried once.
- Concurrent calls share a single refresh. A token that another call or tab already
  refreshed is used instead of being exchanged again. Across tabs this needs `lock`; where
  Web Locks are missing, `webLock()` returns `undefined`.
- If the API refuses the refresh token (expired, revoked or reused), the tokens are
  cleared and `onSessionExpired` runs once. A network error, 429 or 5xx keeps them for the
  next try.
- `/v1/auth/*` calls never carry a token. A request body that's a stream can't be sent
  twice, so send a string or a Blob to calls that may be retried.

## Validation

The client checks every 2xx JSON body against Zod schemas generated from the same
contract. A body that doesn't match means the API and this build disagree. That's
better caught at the call than as a crash three components later.

```ts
createApiClient({ baseUrl }); // validate: "throw" (default): dev, tests, CI
createApiClient({
  baseUrl,
  validate: "report", // production: return the body anyway, but say so
  onInvalidResponse: (error) => reportToMonitoring(error),
});
```

`ResponseValidationError` carries the `operation` (`get /v1/me`), `status`, the `body` as
received and the Zod `issues`. Validation never reshapes data: unknown fields pass
through. Bodies of request models reject unknown fields, as the API does.

The schemas are exported for reuse, e.g. in forms:

```ts
import { schemas, responses } from "@claimforge/api-client";

schemas.AddressInput.safeParse(values); // same limits the API enforces
responses["get /v1/me"][200]; // success bodies by operation and status
```

A type-level test proves that each schema infers exactly the generated TypeScript type.

## React

`@claimforge/api-client/react` has TanStack Query hooks over the client (`react` and
`@tanstack/react-query` are peer dependencies; the main entry point needs neither).

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider, createQueryClient, useLogin, useMe } from "@claimforge/api-client/react";

const queryClient = createQueryClient();

<QueryClientProvider client={queryClient}>
  <ApiProvider client={api}>
    <App />
  </ApiProvider>
</QueryClientProvider>;

function Header() {
  const me = useMe(); // me.data?.memberships, me.error is an ApiError
  const login = useLogin(); // login.mutate({ email, password })
}
```

- **Query client.** `createQueryClient()` retries queries only when that may help
  (`shouldRetry`: no answer, 5xx, 429, 408; at most 3 times). It never retries other 4xx
  or a body that failed validation. Mutations aren't retried.
- **Router loaders.** Every data hook has query options to match (`meQuery(api)`), so a
  loader can prefetch what the component will read.
- **Query keys.** Keys come from `queryKeys` and nest: invalidating
  `queryKeys.organization(id)` reaches everything cached under that organization.
- **Lists.** Cursor-paginated lists are infinite queries. `allItems(data)` flattens the
  loaded pages, and `nextCursor` is the shared `getNextPageParam`.
- **Mutations keep the cache true.**
  - Creating or updating writes the answer straight into the detail.
  - Deleting an organization drops everything cached under it.
  - Lists and `/v1/me`, which name each membership's organization, are refreshed.
  - Revoking an invitation hides it at once and puts it back if the API refuses.
- **Sessions.** `useLogin` and `useAcceptInvitation` reset the cache on success, so a
  new user never sees the last one's data. `useLogout` removes every cached query, even
  offline. When a session ends on its own, call `queryClient.removeQueries()` from
  `onSessionExpired`.

## Regenerating

```bash
just api-openapi                                  # contract + types, from the API code
pnpm --filter @claimforge/api-client generate     # types only, from openapi.json
```

`src/schema.gen.ts` and `src/zod.gen.ts` are committed so contract changes show up in
review. A test fails when either no longer matches `openapi.json`, and the Web workflow
runs whenever the contract changes. The Zod renderer (`scripts/zod.mjs`) refuses JSON
Schema it doesn't understand, so a new construct fails the build instead of being
checked loosely.
