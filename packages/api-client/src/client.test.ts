import { describe, expect, expectTypeOf, test, vi } from "vitest";

import {
  ApiError,
  createApiClient,
  isApiError,
  NetworkError,
  raw,
  ResponseValidationError,
  UNEXPECTED_RESPONSE,
  type ApiClient,
  type ApiClientOptions,
  type Problem,
  type ResponseBody,
  type Schema,
} from "./index";

const ORG = "0b9e6a8e-0000-4000-8000-000000000001";
const CLAIM = "0b9e6a8e-0000-4000-8000-000000000002";
const ADDRESS = { line1: "123 Main St", city: "Austin", region: "TX", postal_code: "78701" };

type Claims = "/v1/organizations/{organization_id}/claims";
type Reports = "/v1/organizations/{organization_id}/claims/{claim_id}/reports";

function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  const type = (init.status ?? 200) >= 400 ? "application/problem+json" : "application/json";
  headers.set("Content-Type", type);
  return new Response(JSON.stringify(body), { ...init, headers });
}

/** A client whose `fetch` records each request and answers with `answer`. */
function fake(answer: () => Response | Promise<Response>) {
  const requests: Request[] = [];
  const api = createApiClient({
    baseUrl: "https://api.test/",
    headers: { "X-Client": "web" },
    validate: "off", // transport tests: the bodies here are minimal, not contract-complete
    fetch: (input, init) => {
      requests.push(new Request(input, init));
      return Promise.resolve(answer());
    },
  });
  return { api, requests };
}

function problem(overrides: Partial<Problem>): Problem {
  return {
    type: "https://claimforge.dev/problems/not_found",
    title: "Not found",
    status: 404,
    detail: "Claim not found",
    instance: "/v1/organizations/x/claims/y",
    code: "not_found",
    ...overrides,
  };
}

describe("requests", () => {
  test("fill path parameters, serialize the query and send default headers", async () => {
    const { api, requests } = fake(() => json({ items: [], next_cursor: null, has_more: false }));

    const page = await api.get("/v1/organizations/{organization_id}/claims", {
      path: { organization_id: "a/b c" },
      query: { status: ["new", "in_progress"], q: "Main St", cursor: null, limit: 25 },
    });

    expect(page.items).toEqual([]);
    const [sent] = requests;
    expect(sent?.method).toBe("GET");
    expect(sent?.url).toBe(
      "https://api.test/v1/organizations/a%2Fb%20c/claims" +
        "?status=new&status=in_progress&q=Main+St&limit=25",
    );
    expect(sent?.headers.get("Accept")).toBe("application/json, application/problem+json");
    expect(sent?.headers.get("X-Client")).toBe("web");
  });

  test("send JSON bodies and expose status and headers through request()", async () => {
    const job = { id: "job", status: "queued" };
    const { api, requests } = fake(() =>
      json(job, { status: 202, headers: { Location: "/reports/job", "Retry-After": "2" } }),
    );

    const result = await api.request(
      "post",
      "/v1/organizations/{organization_id}/claims/{claim_id}/reports",
      {
        path: { organization_id: ORG, claim_id: CLAIM },
        body: { kind: "photo_report" },
        headers: { "X-Client": "mobile" },
      },
    );

    expect(result.status).toBe(202);
    expect(result.data).toEqual(job);
    expect(result.headers.get("Retry-After")).toBe("2");
    const [sent] = requests;
    expect(sent?.headers.get("Content-Type")).toBe("application/json");
    expect(sent?.headers.get("X-Client")).toBe("mobile"); // per-call headers win
    expect(await sent?.json()).toEqual({ kind: "photo_report" });
  });

  test("204 answers resolve to undefined", async () => {
    const { api, requests } = fake(() => new Response(null, { status: 204 }));

    const deleted = api.delete("/v1/organizations/{organization_id}/contacts/{contact_id}", {
      path: { organization_id: ORG, contact_id: CLAIM },
    });

    await expect(deleted).resolves.toBeUndefined();
    expect(requests[0]?.method).toBe("DELETE");
  });

  test("raw bodies go out as they are, with their own content type", async () => {
    const csv = "code,description,unit,unit_price\nWTR DHM,Dehumidifier,DA,123.40\n";
    const { api, requests } = fake(() => json({ created: 1, updated: 0, removed: 0 }));

    await api.post("/v1/organizations/{organization_id}/price-lists/{list_id}/import", {
      path: { organization_id: ORG, list_id: CLAIM },
      query: { dry_run: true },
      body: raw(csv, "text/csv"),
    });

    const [sent] = requests;
    expect(sent?.url).toMatch(/\/import\?dry_run=true$/);
    expect(sent?.headers.get("Content-Type")).toBe("text/csv");
    expect(await sent?.text()).toBe(csv);
  });

  test("a missing path parameter fails before anything is sent", async () => {
    const { api, requests } = fake(() => json({}));
    const call = api.get("/v1/organizations/{organization_id}", {
      path: { organization_id: "" },
    });

    await expect(call).rejects.toThrow('Missing path parameter "organization_id"');
    expect(requests).toEqual([]);
  });
});

describe("failures", () => {
  test("problem details become an ApiError", async () => {
    const invalid = problem({
      status: 422,
      title: "Validation failed",
      detail: "The request is invalid",
      code: "validation_error",
      errors: [{ loc: ["body", "loss_type"], message: "Field required", type: "missing" }],
    });
    const { api } = fake(() => json(invalid, { status: 422 }));

    const error: unknown = await api
      .post("/v1/organizations/{organization_id}/claims", {
        path: { organization_id: ORG },
        body: { loss_type: "water", property: { address: ADDRESS } },
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(isApiError(error, "validation_error")).toBe(true);
    expect(isApiError(error, "not_found")).toBe(false);
    if (!isApiError(error)) throw error;
    expect([error.status, error.code, error.message]).toEqual([
      422,
      "validation_error",
      "The request is invalid",
    ]);
    expect(error.fieldErrors).toEqual(invalid.errors);
    expect(error.problem).toEqual(invalid);
  });

  test("answers without problem details still become an ApiError", async () => {
    const { api } = fake(
      () =>
        new Response("<html>Bad gateway</html>", {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "Content-Type": "text/html", "X-Request-ID": "req-1" },
        }),
    );

    const error: unknown = await api.get("/v1/me").catch((caught: unknown) => caught);

    if (!isApiError(error)) throw error;
    expect(error.problem).toEqual({
      type: "about:blank",
      title: "Bad Gateway",
      status: 502,
      detail: "The server answered 502 Bad Gateway without problem details",
      instance: "/v1/me",
      code: UNEXPECTED_RESPONSE,
      request_id: "req-1",
    });
    expect(error.fieldErrors).toEqual([]);
  });

  test("JSON that isn't a problem is treated the same way", async () => {
    const { api } = fake(() => json({ message: "nope" }, { status: 500 }));

    const error: unknown = await api.get("/v1/me").catch((caught: unknown) => caught);

    expect(isApiError(error, UNEXPECTED_RESPONSE)).toBe(true);
  });

  test("no answer at all is a NetworkError", async () => {
    const cause = new TypeError("fetch failed");
    const api = createApiClient({
      baseUrl: "https://api.test",
      fetch: () => Promise.reject(cause),
    });

    const error: unknown = await api.get("/v1/me").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).message).toBe(
      "Couldn't reach the API (GET https://api.test/v1/me)",
    );
    expect((error as NetworkError).cause).toBe(cause);
  });

  test("an aborted request rejects with the abort reason, not a NetworkError", async () => {
    const api = createApiClient({
      baseUrl: "https://api.test",
      fetch: (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    });
    const controller = new AbortController();
    const reason = new Error("query cancelled");

    const call = api.get("/v1/me", { signal: controller.signal });
    controller.abort(reason);

    await expect(call).rejects.toBe(reason);
  });

  test("uses the global fetch by default", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ id: "me" }));
    try {
      await createApiClient({ baseUrl: "https://api.test", validate: "off" }).get("/v1/me");
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("validation", () => {
  const me = {
    id: "0198a2c4-7b1e-7cc0-8000-000000000001",
    email: "morgan@example.com",
    full_name: "Morgan Member",
    memberships: [],
  };
  const broken = { ...me, id: "me", memberships: [{ role: "intern" }] };

  function client(
    body: unknown,
    options: Pick<ApiClientOptions, "validate" | "onInvalidResponse">,
  ) {
    return createApiClient({
      baseUrl: "https://api.test",
      fetch: () => Promise.resolve(json(body)),
      ...options,
    });
  }

  test("bodies that match the contract come back as received", async () => {
    const extra = { ...me, nickname: "Mo" }; // a newer API may add fields
    await expect(client(extra, {}).get("/v1/me")).resolves.toEqual(extra);
  });

  test("by default a body that doesn't match rejects the call", async () => {
    const error: unknown = await client(broken, {})
      .get("/v1/me")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResponseValidationError);
    const invalid = error as ResponseValidationError;
    expect([invalid.operation, invalid.status, invalid.body]).toEqual(["get /v1/me", 200, broken]);
    expect(invalid.issues.map((issue) => issue.path.join("."))).toEqual([
      "id",
      "memberships.0.organization",
      "memberships.0.permissions",
      "memberships.0.role",
    ]);
    expect(invalid.message).toMatch(/^get \/v1\/me answered 200 with a body that doesn't match/);
  });

  test("report mode hands the body over and tells someone", async () => {
    const onInvalidResponse = vi.fn();

    const body = await client(broken, { validate: "report", onInvalidResponse }).get("/v1/me");

    expect(body).toEqual(broken);
    expect(onInvalidResponse).toHaveBeenCalledWith(expect.any(ResponseValidationError));
  });

  test("off means off", async () => {
    await expect(client(broken, { validate: "off" }).get("/v1/me")).resolves.toEqual(broken);
  });
});

// Never called: `tsc` checks these signatures, and each @ts-expect-error must stay an error.
function signatures(api: ApiClient) {
  return [
    async () => {
      expectTypeOf(await api.get("/v1/me")).toEqualTypeOf<Schema<"MeResponse">>();
      expectTypeOf(
        await api.get("/v1/organizations/{organization_id}/claims", {
          path: { organization_id: ORG },
        }),
      ).toEqualTypeOf<ResponseBody<Claims, "get">>();
      expectTypeOf(
        await api.patch("/v1/organizations/{organization_id}/claims/{claim_id}", {
          path: { organization_id: ORG, claim_id: CLAIM },
          body: { carrier_name: "Lone Star Mutual" },
        }),
      ).toEqualTypeOf<Schema<"ClaimRead">>();
      expectTypeOf(
        (
          await api.request(
            "post",
            "/v1/organizations/{organization_id}/claims/{claim_id}/reports",
            {
              path: { organization_id: ORG, claim_id: CLAIM },
              body: { kind: "drying_report" },
            },
          )
        ).data,
      ).toEqualTypeOf<ResponseBody<Reports, "post">>();
      const deleted = api.delete("/v1/organizations/{organization_id}/contacts/{contact_id}", {
        path: { organization_id: ORG, contact_id: CLAIM },
      });
      expectTypeOf(deleted).resolves.toBeUndefined();
      await deleted;
    },
    async () => {
      // @ts-expect-error /v1/auth/login only takes POST
      await api.get("/v1/auth/login");
      // @ts-expect-error the claim path needs its parameters
      await api.get("/v1/organizations/{organization_id}/claims/{claim_id}");
      await api.get("/v1/organizations/{organization_id}/claims/{claim_id}", {
        // @ts-expect-error claim_id is missing
        path: { organization_id: ORG },
      });
      await api.post("/v1/organizations/{organization_id}/claims", {
        path: { organization_id: ORG },
        // @ts-expect-error loss_type must be one of the contract's values
        body: { loss_type: "meteor", property: { address: ADDRESS } },
      });
      await api.get("/v1/organizations/{organization_id}/claims", {
        path: { organization_id: ORG },
        // @ts-expect-error status filters are claim statuses
        query: { status: ["lost"] },
      });
      await api.post("/v1/organizations/{organization_id}/price-lists/{list_id}/import", {
        path: { organization_id: ORG, list_id: CLAIM },
        // @ts-expect-error imports send the CSV itself, not JSON
        body: { rows: [] },
      });
      // @ts-expect-error GETs take no body
      await api.get("/v1/me", { body: {} });
    },
  ];
}

describe("types", () => {
  test("calls are typed by the contract", () => {
    expectTypeOf(signatures).toBeFunction();
  });
});
