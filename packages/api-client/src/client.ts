/**
 * A thin, fully typed wrapper around `fetch` for the ClaimForge API.
 *
 *     const api = createApiClient({ baseUrl: "https://api.example.com" });
 *     const claim = await api.get("/v1/organizations/{organization_id}/claims/{claim_id}", {
 *       path: { organization_id, claim_id },
 *     });
 *
 * Paths, parameters, bodies and results all come from the generated contract types, so a
 * renamed field or a removed endpoint is a compile error in the calling code.
 */
import { ApiError, NetworkError } from "./errors";
import type {
  ApiPath,
  HttpMethod,
  MethodOf,
  Operation,
  PathParams,
  QueryParams,
  RequestBody,
  ResponseBody,
} from "./index";

// ─── Types ───────────────────────────────────────────────────────────────────

/** The paths that support a method: `PathsFor<"delete">`. */
export type PathsFor<M extends HttpMethod> = {
  [P in ApiPath]: M extends MethodOf<P> ? P : never;
}[ApiPath];

/** A non-JSON request body (a CSV import, a logo image). Build it with `raw()`. */
export class RawBody {
  constructor(
    readonly content: BodyInit,
    readonly contentType: string,
  ) {}
}

/** Send `content` as is, labelled with `contentType`, instead of as JSON. */
export function raw(content: BodyInit, contentType: string): RawBody {
  return new RawBody(content, contentType);
}

type PathOption<P extends ApiPath, M extends MethodOf<P>> = [PathParams<P, M>] extends [never]
  ? { path?: never }
  : { path: PathParams<P, M> };

type QueryOption<P extends ApiPath, M extends MethodOf<P>> = [QueryParams<P, M>] extends [never]
  ? { query?: never }
  : object extends QueryParams<P, M>
    ? { query?: QueryParams<P, M> }
    : { query: QueryParams<P, M> };

type BodyOption<P extends ApiPath, M extends MethodOf<P>> = Operation<
  P,
  M
>["requestBody"] extends undefined
  ? { body?: never }
  : [RequestBody<P, M>] extends [never]
    ? { body: RawBody }
    : undefined extends Operation<P, M>["requestBody"]
      ? { body?: RequestBody<P, M> }
      : { body: RequestBody<P, M> };

/** Everything a call can carry. `path` and `body` are required when the operation needs them. */
export type RequestOptions<P extends ApiPath, M extends MethodOf<P>> = PathOption<P, M> &
  QueryOption<P, M> &
  BodyOption<P, M> & {
    /** Cancels the request; the call then rejects with the abort reason. */
    signal?: AbortSignal;
    /** Extra headers for this call only. */
    headers?: HeadersInit;
  };

/** The options argument, optional when nothing in it is required. */
type Args<Options> = object extends Options ? [options?: Options] : [options: Options];

/** A successful answer, with the status and headers some endpoints use (202 + `Location`). */
export interface ApiResult<P extends ApiPath, M extends MethodOf<P>> {
  data: ResponseBody<P, M>;
  status: number;
  headers: Headers;
}

export interface ApiClientOptions {
  /** Where the API lives, e.g. `https://api.example.com` (paths already start with `/v1`). */
  baseUrl: string;
  /** Defaults to the global `fetch`; tests pass a fake. */
  fetch?: typeof fetch;
  /** Headers sent with every call. */
  headers?: HeadersInit;
}

type Call<M extends HttpMethod> = <P extends PathsFor<M>>(
  path: P,
  ...args: Args<RequestOptions<P, M & MethodOf<P>>>
) => Promise<ResponseBody<P, M & MethodOf<P>>>;

export interface ApiClient {
  /** Make any call and get the status and headers along with the body. */
  request<M extends HttpMethod, P extends PathsFor<M>>(
    method: M,
    path: P,
    ...args: Args<RequestOptions<P, M & MethodOf<P>>>
  ): Promise<ApiResult<P, M & MethodOf<P>>>;
  get: Call<"get">;
  post: Call<"post">;
  put: Call<"put">;
  patch: Call<"patch">;
  delete: Call<"delete">;
}

// ─── Implementation ──────────────────────────────────────────────────────────

/** What the implementation sees once the types have done their job. */
interface LooseOptions {
  path?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

const ACCEPT = "application/json, application/problem+json";

export function createApiClient(options: ApiClientOptions): ApiClient {
  const send = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  async function request(
    method: HttpMethod,
    template: string,
    call: LooseOptions = {},
  ): Promise<{ data: unknown; status: number; headers: Headers }> {
    const url = baseUrl + fillPath(template, call.path) + queryString(call.query);
    const headers = new Headers(options.headers);
    new Headers(call.headers).forEach((value, name) => {
      headers.set(name, value);
    });
    if (!headers.has("Accept")) {
      headers.set("Accept", ACCEPT);
    }

    let body: BodyInit | undefined;
    if (call.body instanceof RawBody) {
      body = call.body.content;
      headers.set("Content-Type", call.body.contentType);
    } else if (call.body !== undefined) {
      body = JSON.stringify(call.body);
      headers.set("Content-Type", "application/json");
    }

    let response: Response;
    try {
      response = await send(url, {
        method: method.toUpperCase(),
        headers,
        body: body ?? null,
        signal: call.signal ?? null,
      });
    } catch (error) {
      if (call.signal?.aborted) {
        throw call.signal.reason ?? error;
      }
      throw new NetworkError(method, url, error);
    }

    if (!response.ok) {
      throw await ApiError.from(response, url);
    }
    return { data: await readBody(response), status: response.status, headers: response.headers };
  }

  const data =
    (method: HttpMethod) =>
    async (path: string, call?: LooseOptions): Promise<unknown> =>
      (await request(method, path, call)).data;

  // The public signatures are checked by the types above; the implementation is untyped
  // in between, so the casts here are the one place the two meet.
  return {
    request: request as ApiClient["request"],
    get: data("get") as ApiClient["get"],
    post: data("post") as ApiClient["post"],
    put: data("put") as ApiClient["put"],
    patch: data("patch") as ApiClient["patch"],
    delete: data("delete") as ApiClient["delete"],
  };
}

/** `/claims/{claim_id}` + `{ claim_id: "a b" }` → `/claims/a%20b`. */
export function fillPath(template: string, params: LooseOptions["path"] = {}): string {
  return template.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined || value === "") {
      throw new TypeError(`Missing path parameter "${name}" for ${template}`);
    }
    return encodeURIComponent(String(value));
  });
}

/**
 * Query parameters as FastAPI reads them: arrays as repeated keys (`status=new&status=open`),
 * `null` and `undefined` left out.
 */
export function queryString(query: LooseOptions["query"] = {}): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) {
        search.append(name, String(item));
      }
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }
  const type = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const text = await response.text();
  if (text === "") {
    return undefined;
  }
  // Every 2xx body in the contract is JSON; anything else is handed back as text.
  return type === "application/json" || type.endsWith("+json") ? JSON.parse(text) : text;
}
