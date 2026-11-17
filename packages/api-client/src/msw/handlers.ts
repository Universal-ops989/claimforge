/**
 * Mock Service Worker handlers held to the API contract: `@claimforge/api-client/msw`.
 *
 *     const api = mockApi("https://api.test");
 *     server.use(
 *       api.get("/v1/organizations/{organization_id}/claims/{claim_id}", ({ params }) =>
 *         claim({ id: params.claim_id }),
 *       ),
 *     );
 *
 * Paths, params, request bodies and answers are typed from the contract, and checked
 * against it at runtime too:
 * - A plain answer gets the operation's success status (201 for creates, 204 without a
 *   body). `respond(status, body)` picks another documented one.
 * - An answer the contract doesn't allow becomes a 500 `mock_contract_violation` naming
 *   the field, so a stale mock fails its test instead of passing on data the API can't send.
 * - A JSON request body the contract would refuse gets the API's 422 `validation_failed`,
 *   with `errors[]` shaped as the API shapes them, and the resolver isn't called.
 *
 * A `Response` built by hand (`problem(…)`, `new Response(…)`) is sent as it is: that's how
 * a test sends an error, or a deliberately broken body.
 */
import { http, HttpResponse, type HttpHandler } from "msw";
import { z } from "zod";

import type { PathsFor } from "../client";
import type {
  ApiPath,
  HttpMethod,
  MethodOf,
  PathParams,
  Problem,
  RequestBody,
  ResponseBody,
  SuccessStatus,
} from "../index";
import { requests, responses, successStatuses } from "../zod.gen";

const PROBLEM_TYPES = "https://claimforge.dev/problems/";

/** Success bodies and request bodies, looked up by `"post /v1/…"` (and status). */
const SUCCESS_BODIES: Partial<Record<string, Partial<Record<number, z.ZodType>>>> = responses;
const REQUEST_BODIES: Partial<Record<string, z.ZodType>> = requests;

// ─── Errors ──────────────────────────────────────────────────────────────────

/**
 * An error as the API sends it (RFC 9457 problem details): `problem(409, "status_changed")`.
 * `extensions` adds or overrides fields, e.g. `{ detail: "…", errors: [...] }`.
 */
export function problem(
  status: number,
  code: string,
  extensions: Partial<Problem> & Record<string, unknown> = {},
): Response {
  const body: Problem = {
    type: PROBLEM_TYPES + code.replaceAll("_", "-"),
    title: code.replaceAll("_", " "),
    status,
    detail: code.replaceAll("_", " "),
    instance: "/",
    code,
    ...extensions,
  };
  return HttpResponse.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

/** The API's answer to a request body it can't accept. */
function validationFailed(request: Request, error: z.ZodError): Response {
  const errors = error.issues.map((issue) => ({
    loc: ["body", ...issue.path.map((part) => (typeof part === "symbol" ? String(part) : part))],
    message: issue.message,
    type: issue.code,
  }));
  return problem(422, "validation_failed", {
    title: "Invalid request",
    detail: `${String(errors.length)} field(s) failed validation`,
    instance: new URL(request.url).pathname,
    errors,
  });
}

// ─── Handlers ────────────────────────────────────────────────────────────────

type MaybePromise<T> = T | Promise<T>;

/** Path parameters as they arrive in a URL: strings. */
type UrlParams<P extends ApiPath, M extends MethodOf<P>> = {
  [Name in keyof PathParams<P, M>]: string;
};

/** What a resolver is given. */
export interface MockRequest<P extends ApiPath, M extends MethodOf<P>> {
  request: Request;
  params: UrlParams<P, M>;
  /** The query string, parsed. */
  query: URLSearchParams;
  /** The JSON body, already checked against the contract (`undefined` when there's none). */
  body: [RequestBody<P, M>] extends [never] ? undefined : RequestBody<P, M>;
  /** Answer with a documented success status other than the first, e.g. 200 for a repeat. */
  respond: <Status extends SuccessStatus<P, M>>(
    status: Status,
    body: ResponseBody<P, M, Status>,
  ) => Response;
}

/** What a resolver may answer: the success body, or any `Response`. */
export type MockAnswer<P extends ApiPath, M extends MethodOf<P>> = ResponseBody<P, M> | Response;

/** Resolvers for operations without a body answer `undefined` (204). */
export type MockResolver<P extends ApiPath, M extends MethodOf<P>> = (
  request: MockRequest<P, M>,
) => MaybePromise<MockAnswer<P, M>>;

/** A resolver as the implementation calls it, once the types have done their job. */
type LooseResolver = (request: {
  request: Request;
  params: unknown;
  query: URLSearchParams;
  body: unknown;
  respond: (status: number, body: unknown) => Response;
}) => MaybePromise<unknown>;

type Mock<M extends HttpMethod> = <P extends PathsFor<M>>(
  path: P,
  resolver: MockResolver<P, M & MethodOf<P>>,
) => HttpHandler;

export interface MockApi {
  get: Mock<"get">;
  post: Mock<"post">;
  put: Mock<"put">;
  patch: Mock<"patch">;
  delete: Mock<"delete">;
}

/** `/v1/organizations/{organization_id}` → `/v1/organizations/:organization_id`. */
function routeOf(template: string): string {
  return template.replace(/\{(\w+)\}/g, ":$1");
}

/**
 * Typed handlers for the API at `baseUrl` (any origin when left out). Each handler checks
 * request bodies and its own answers against the contract; see the module comment.
 */
export function mockApi(baseUrl = "*"): MockApi {
  const base = baseUrl.replace(/\/+$/, "");

  /** Send `body` with `status`, or a 500 saying how it breaks the contract. */
  function answer(operation: string, status: number, body: unknown): Response {
    if (status === 204) {
      return new HttpResponse(null, { status });
    }
    const checked = SUCCESS_BODIES[operation]?.[status]?.safeParse(body);
    if (checked && !checked.success) {
      return problem(500, "mock_contract_violation", {
        title: "Mock answer breaks the contract",
        detail: `The mock for ${operation} answered ${String(status)} with a body the contract doesn't allow:\n${z.prettifyError(checked.error)}`,
      });
    }
    return HttpResponse.json(body as Record<string, unknown>, { status });
  }

  function mock(method: HttpMethod): Mock<HttpMethod> {
    return (template, resolver) => {
      const operation = `${method} ${template}`;
      const statuses = successStatuses[operation] ?? [200];
      return http[method](`${base}${routeOf(template)}`, async ({ request, params }) => {
        let body: unknown = undefined;
        const schema = REQUEST_BODIES[operation];
        if (schema) {
          const text = await request.clone().text();
          let parsed: unknown;
          try {
            parsed = text === "" ? undefined : JSON.parse(text);
          } catch {
            return problem(422, "validation_failed", {
              title: "Invalid request",
              detail: "The body isn't JSON",
              instance: new URL(request.url).pathname,
              errors: [{ loc: ["body"], message: "Invalid JSON", type: "json_invalid" }],
            });
          }
          const checked = schema.safeParse(parsed);
          if (!checked.success) {
            return validationFailed(request, checked.error);
          }
          body = parsed;
        }

        const given = await (resolver as unknown as LooseResolver)({
          request,
          params,
          query: new URL(request.url).searchParams,
          body,
          respond: (status, sent) => answer(operation, status, sent),
        });
        if (given instanceof Response) {
          return given;
        }
        const status = given === undefined && statuses.includes(204) ? 204 : (statuses[0] ?? 200);
        return answer(operation, status, given);
      });
    };
  }

  return {
    get: mock("get"),
    post: mock("post"),
    put: mock("put"),
    patch: mock("patch"),
    delete: mock("delete"),
  };
}
