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

## Regenerating

```bash
just api-openapi                                  # contract + types, from the API code
pnpm --filter @claimforge/api-client generate     # types only, from openapi.json
```

`src/schema.gen.ts` is committed so contract changes show up in review. A test fails
when it no longer matches `openapi.json`, and the Web workflow runs whenever the
contract changes.
