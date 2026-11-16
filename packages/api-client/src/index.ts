/**
 * Types for the ClaimForge API, generated from its OpenAPI contract (`schema.gen.ts`).
 *
 * Prefer the named helpers to indexing `paths` by hand:
 *
 *     type Claim = Schema<"ClaimRead">;
 *     type NewClaim = RequestBody<"/v1/organizations/{organization_id}/claims", "post">;
 *     type Claims = ResponseBody<"/v1/organizations/{organization_id}/claims", "get">;
 */
import type { components, operations, paths } from "./schema.gen";

export type { components, operations, paths };

// ─── Schemas ─────────────────────────────────────────────────────────────────

/** Every named schema in the contract, by name. */
export type Schemas = components["schemas"];
export type SchemaName = keyof Schemas;
/** One named schema: `Schema<"ClaimRead">`. */
export type Schema<Name extends SchemaName> = Schemas[Name];

/** The body of every error response (RFC 9457 problem details). */
export type Problem = Schema<"Problem">;
/** One entry of `Problem.errors` when validation fails. */
export type FieldError = Schema<"FieldError">;

/**
 * One page of a cursor-paginated list. The contract names each instance separately
 * (`CursorPage_ClaimSummary_`); this generic lets hooks treat every list alike.
 * Pass `next_cursor` back as `cursor` to fetch the next page.
 */
export interface CursorPage<Item> {
  items: Item[];
  next_cursor: string | null;
  has_more: boolean;
}

// ─── Operations ──────────────────────────────────────────────────────────────

/** Every path template the API serves, e.g. `/v1/organizations/{organization_id}`. */
export type ApiPath = keyof paths;
export type HttpMethod = "get" | "put" | "post" | "delete" | "patch";

/** The methods a path supports. Unsupported ones are `never` in the generated types. */
export type MethodOf<P extends ApiPath> = {
  [M in HttpMethod]: paths[P][M] extends undefined ? never : M;
}[HttpMethod];

/** The operation behind a path and method. */
export type Operation<P extends ApiPath, M extends MethodOf<P>> = NonNullable<paths[P][M]>;

/** Path parameters (`never` when the path has none). */
export type PathParams<P extends ApiPath, M extends MethodOf<P>> = NonNullable<
  Operation<P, M>["parameters"]["path"]
>;

/** Query parameters, all optional unless the API requires them (`never` when there are none). */
export type QueryParams<P extends ApiPath, M extends MethodOf<P>> = NonNullable<
  Operation<P, M>["parameters"]["query"]
>;

/** Data travels as JSON; errors as RFC 9457 problem details. */
type JsonMediaType = "application/json" | "application/problem+json";

// Distributive on purpose: `never` (no request body, no 2xx response) stays `never`, and a
// union of responses (200 | 201) gives the union of their bodies.
type JsonContent<Message, Otherwise> = Message extends { content: infer Content }
  ? [Extract<keyof Content, JsonMediaType>] extends [never]
    ? Otherwise
    : Content[Extract<keyof Content, JsonMediaType>]
  : Otherwise;

/** The JSON request body (`never` when the operation takes none, or takes a file instead). */
export type RequestBody<P extends ApiPath, M extends MethodOf<P>> = JsonContent<
  NonNullable<Operation<P, M>["requestBody"]>,
  never
>;

type Responses<P extends ApiPath, M extends MethodOf<P>> = Operation<P, M>["responses"];

/** The 2xx statuses an operation documents, e.g. `201` for most creates. */
export type SuccessStatus<P extends ApiPath, M extends MethodOf<P>> = Extract<
  keyof Responses<P, M>,
  200 | 201 | 202 | 203 | 204 | 206
>;

/**
 * The JSON body of a response: the success body unless a status is given.
 * `undefined` for responses without a body (204 No Content).
 */
export type ResponseBody<
  P extends ApiPath,
  M extends MethodOf<P>,
  Status extends keyof Responses<P, M> = SuccessStatus<P, M>,
> = JsonContent<Responses<P, M>[Status], undefined>;
