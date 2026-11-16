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
import type { z } from "zod";

import { RefreshRefused, Session, type AuthOptions, type Exchange, type Tokens } from "./auth";
import { ApiError, NetworkError, ResponseValidationError, UploadError } from "./errors";
import type {
  ApiPath,
  HttpMethod,
  MethodOf,
  Operation,
  PathParams,
  QueryParams,
  RequestBody,
  ResponseBody,
  Schema,
} from "./index";
import { responses } from "./zod.gen";

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
  /** Sign calls with a bearer token and keep the session fresh. */
  auth?: AuthOptions;
  /**
   * Check 2xx JSON bodies against the contract's Zod schemas:
   * - `"throw"` (default): the call rejects with `ResponseValidationError`.
   * - `"report"`: the body is returned anyway and `onInvalidResponse` is called. For
   *   production, where an older build may meet a newer API (a new status, say).
   * - `"off"`: no checks.
   *
   * Either way the body is returned as received, never reshaped.
   */
  validate?: "throw" | "report" | "off";
  onInvalidResponse?: (error: ResponseValidationError) => void;
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
  /** Sign in and keep the tokens. Needs the `auth` option. */
  login(credentials: RequestBody<"/v1/auth/login", "post">): Promise<Tokens>;
  /**
   * Accept an invitation, which signs in (creating the account when it's new), and keep
   * the tokens. Needs the `auth` option.
   */
  acceptInvitation(invitation: RequestBody<"/v1/invitations/accept", "post">): Promise<Tokens>;
  /**
   * Forget the tokens, then ask the API to revoke the session. Signing out locally always
   * works; a failure to reach the API leaves the refresh token valid until it expires.
   */
  logout(): Promise<void>;
  /**
   * Send a file to a signed upload link: the `upload` that `POST …/photo-uploads` or
   * `POST …/document-uploads` answers with. It goes straight to storage with only the
   * link's method and headers, never the bearer token or this client's default headers.
   * Rejects with `UploadError`; `POST …/complete` afterwards turns it into a photo or
   * document.
   */
  sendFile(link: SignedUpload, file: Blob, options?: { signal?: AbortSignal }): Promise<void>;
}

type SignedUpload = Schema<"SignedUploadRead">;

/** How much of storage's error answer an `UploadError` keeps. */
const DETAIL_LIMIT = 500;

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
/** The code of a 401 that a fresh access token can fix. */
export const AUTHENTICATION_REQUIRED = "authentication_required";
/** The generated schemas, looked up by `"get /v1/me"` and status. */
const SUCCESS_BODIES: Partial<Record<string, Partial<Record<number, z.ZodType>>>> = responses;
/** Calls that issue or revoke tokens themselves, and so never carry one. */
function carriesNoToken(template: string): boolean {
  return template.startsWith("/v1/auth/") || template === "/v1/invitations/accept";
}

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

    async function attempt(tokens: Tokens | null): Promise<Response> {
      const signed = new Headers(headers);
      if (tokens !== null) {
        signed.set("Authorization", `Bearer ${tokens.accessToken}`);
      }
      try {
        return await send(url, {
          method: method.toUpperCase(),
          headers: signed,
          body: body ?? null,
          signal: call.signal ?? null,
        });
      } catch (error) {
        if (call.signal?.aborted) {
          throw call.signal.reason ?? error;
        }
        throw new NetworkError(method, url, error);
      }
    }

    const tokens = session && !carriesNoToken(template) ? await session.current() : null;
    let response = await attempt(tokens);
    // An access token can expire or be revoked between the check above and the call:
    // refresh once and retry once. A second 401 is the answer.
    if (response.status === 401 && session !== null && tokens !== null) {
      const error = await ApiError.from(response, url);
      if (error.code !== AUTHENTICATION_REQUIRED) {
        throw error;
      }
      const renewed = await session.renew(tokens);
      if (renewed === null) {
        throw error;
      }
      response = await attempt(renewed);
    }

    if (!response.ok) {
      throw await ApiError.from(response, url);
    }
    const data = await readBody(response);
    check(`${method} ${template}`, response.status, data);
    return { data, status: response.status, headers: response.headers };
  }

  const mode = options.validate ?? "throw";
  function check(operation: string, status: number, data: unknown): void {
    const schema = mode === "off" ? undefined : SUCCESS_BODIES[operation]?.[status];
    if (schema === undefined) {
      return;
    }
    const result = schema.safeParse(data);
    if (result.success) {
      return;
    }
    const error = new ResponseValidationError(operation, status, data, result.error);
    if (mode === "throw") {
      throw error;
    }
    options.onInvalidResponse?.(error);
  }

  const exchange: Exchange = async (refreshToken) => {
    try {
      const { data } = await request("post", "/v1/auth/refresh", {
        body: { refresh_token: refreshToken },
      });
      return data as Schema<"TokenResponse">;
    } catch (error) {
      if (error instanceof ApiError && isRefusal(error.status)) {
        throw new RefreshRefused(error.code, { cause: error });
      }
      throw error;
    }
  };
  const session = options.auth ? new Session(options.auth, exchange) : null;

  function signedIn(): Session {
    if (session === null) {
      throw new TypeError("Pass `auth` to createApiClient to sign in");
    }
    return session;
  }

  /** Call an endpoint that answers with a token pair, and keep it. */
  async function signIn(path: string, body: unknown): Promise<Tokens> {
    const current = signedIn();
    const { data } = await request("post", path, { body });
    const tokens = current.stamp(data as Schema<"TokenResponse">);
    await current.save(tokens);
    return tokens;
  }

  async function logout(): Promise<void> {
    const current = signedIn();
    const tokens = await current.tokens();
    await current.save(null);
    if (tokens !== null) {
      await request("post", "/v1/auth/logout", {
        body: { refresh_token: tokens.refreshToken },
      }).catch(() => undefined);
    }
  }

  const data =
    (method: HttpMethod) =>
    async (path: string, call?: LooseOptions): Promise<unknown> =>
      (await request(method, path, call)).data;

  // The public signatures are checked by the types above; the implementation is untyped
  // in between, so the casts here are the one place the two meet.
  async function sendFile(
    link: SignedUpload,
    file: Blob,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<void> {
    // Resolved against the API, in case a storage backend ever answers with a path.
    const url = new URL(link.url, `${baseUrl}/`);
    // Never the whole link in a message: its query string is the credential.
    const where = `${link.method} ${url.origin}`;
    if (Date.parse(link.expires_at) <= Date.now()) {
      throw new UploadError("expired", `The upload link expired at ${link.expires_at}`);
    }
    let response: Response;
    try {
      response = await send(url.href, {
        method: link.method,
        headers: new Headers(link.headers),
        body: file,
        signal: signal ?? null,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw signal.reason ?? error;
      }
      throw new UploadError("unreachable", `Couldn't reach storage (${where})`, null, null, {
        cause: error,
      });
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, DETAIL_LIMIT) || null;
      throw new UploadError(
        "rejected",
        `Storage refused the file with ${String(response.status)} (${where})`,
        response.status,
        detail,
      );
    }
  }

  return {
    request: request as ApiClient["request"],
    get: data("get") as ApiClient["get"],
    post: data("post") as ApiClient["post"],
    put: data("put") as ApiClient["put"],
    patch: data("patch") as ApiClient["patch"],
    delete: data("delete") as ApiClient["delete"],
    login: (credentials) => signIn("/v1/auth/login", credentials),
    acceptInvitation: (invitation) => signIn("/v1/invitations/accept", invitation),
    logout,
    sendFile,
  };
}

/** The API refused the refresh token itself; anything else (408, 429, 5xx) may pass. */
function isRefusal(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
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
