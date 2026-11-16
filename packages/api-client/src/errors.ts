/**
 * What a failed API call throws.
 *
 * - `ApiError`: the API (or something in front of it) answered with a non-2xx status.
 *   It always carries a `Problem`, synthesized when the answer wasn't problem details.
 * - `NetworkError`: no answer at all (offline, DNS, CORS, connection reset).
 * - `ResponseValidationError`: a 2xx body that doesn't match the contract.
 *
 * An aborted request rejects with the abort reason itself, so TanStack Query can tell
 * a cancelled query from a failed one.
 */
import { z } from "zod";

import type { FieldError, Problem } from "./index";

/** The `code` of a problem the client made up because the answer wasn't problem details. */
export const UNEXPECTED_RESPONSE = "unexpected_response";

const PROBLEM_MEDIA_TYPES = ["application/problem+json", "application/json"];

export class ApiError extends Error {
  override name = "ApiError";
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail || problem.title);
    this.problem = problem;
  }

  /** The HTTP status, e.g. 404. */
  get status(): number {
    return this.problem.status;
  }

  /** The stable, machine-readable error code, e.g. `claim_locked`. */
  get code(): string {
    return this.problem.code;
  }

  /** Validation errors (422), empty for every other problem. */
  get fieldErrors(): FieldError[] {
    return this.problem.errors ?? [];
  }

  /**
   * Read the problem from a failed response to a request for `url`. Consumes the body.
   * A gateway's HTML error page or an empty 502 becomes an `unexpected_response` problem.
   */
  static async from(response: Response, url: string): Promise<ApiError> {
    if (isJson(response)) {
      const parsed: unknown = await response.json().catch(() => undefined);
      if (isProblem(parsed)) {
        return new ApiError(parsed);
      }
    } else {
      await response.body?.cancel().catch(() => undefined);
    }
    const title = response.statusText || `HTTP ${String(response.status)}`;
    return new ApiError({
      type: "about:blank",
      title,
      status: response.status,
      detail: `The server answered ${String(response.status)} ${title} without problem details`,
      instance: new URL(url, "http://localhost").pathname,
      code: UNEXPECTED_RESPONSE,
      request_id: response.headers.get("X-Request-ID"),
    });
  }
}

export class NetworkError extends Error {
  override name = "NetworkError";

  constructor(method: string, url: string, cause: unknown) {
    super(`Couldn't reach the API (${method.toUpperCase()} ${url})`, { cause });
  }
}

/**
 * Uploading a file failed:
 * - `invalid`: the file doesn't meet the contract (its type, an empty file, a long name);
 *   nothing was sent. `cause` is the `ZodError`.
 * - `expired`: the link ran out before anything was sent; ask the API for a new one.
 * - `rejected`: storage answered with an error (`status`, and `detail`: the start of its
 *   answer, usually XML naming the reason).
 * - `unreachable`: no answer at all.
 */
export class UploadError extends Error {
  override name = "UploadError";

  constructor(
    readonly reason: "invalid" | "expired" | "rejected" | "unreachable",
    message: string,
    readonly status: number | null = null,
    readonly detail: string | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class ResponseValidationError extends Error {
  override name = "ResponseValidationError";

  constructor(
    /** The call, as the contract names it: `get /v1/organizations/{organization_id}`. */
    readonly operation: string,
    readonly status: number,
    /** The body as received. */
    readonly body: unknown,
    readonly error: z.ZodError,
  ) {
    super(
      `${operation} answered ${String(status)} with a body that doesn't match the contract:
` + z.prettifyError(error),
    );
  }

  get issues(): z.core.$ZodIssue[] {
    return this.error.issues;
  }
}

/** True for an `ApiError`, optionally only one with the given code. */
export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

function isJson(response: Response): boolean {
  const type = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
  return type !== undefined && PROBLEM_MEDIA_TYPES.includes(type);
}

function isProblem(body: unknown): body is Problem {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const { status, code, title } = body as Record<string, unknown>;
  return typeof status === "number" && typeof code === "string" && typeof title === "string";
}
