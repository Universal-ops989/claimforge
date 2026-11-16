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

## Regenerating

```bash
just api-openapi                                  # contract + types, from the API code
pnpm --filter @claimforge/api-client generate     # types only, from openapi.json
```

`src/schema.gen.ts` is committed so contract changes show up in review. A test fails
when it no longer matches `openapi.json`, and the Web workflow runs whenever the
contract changes.
