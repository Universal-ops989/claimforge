import { HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, test } from "vitest";

import { document as documentFixture, ids, organization } from "../fixtures";
import {
  ApiError,
  createApiClient,
  isApiError,
  ResponseValidationError,
  type Schema,
} from "../index";
import { mockApi, problem } from "./handlers";

const ORG = ids.organization;
const CLAIM = ids.claim;

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const mock = mockApi("https://api.test");
const client = createApiClient({ baseUrl: "https://api.test" });

describe("answers", () => {
  test("params arrive as strings and the body goes back as JSON", async () => {
    server.use(
      mock.get("/v1/organizations/{organization_id}", ({ params }) => {
        expectTypeOf(params).toEqualTypeOf<{ organization_id: string }>();
        return organization({ id: params.organization_id });
      }),
    );

    const got = await client.get("/v1/organizations/{organization_id}", {
      path: { organization_id: ORG },
    });

    expect(got).toEqual(organization());
  });

  test("a plain answer gets the operation's success status", async () => {
    server.use(
      mock.post("/v1/organizations", ({ body }) => organization({ name: body.name })),
      mock.delete("/v1/organizations/{organization_id}", () => undefined),
    );

    const created = await client.request("post", "/v1/organizations", {
      body: { name: "Gulf Coast" },
    });
    const deleted = await client.request("delete", "/v1/organizations/{organization_id}", {
      path: { organization_id: ORG },
    });

    expect([created.status, created.data.name]).toEqual([201, "Gulf Coast"]);
    expect([deleted.status, deleted.data]).toEqual([204, undefined]);
  });

  test("respond() picks another documented status", async () => {
    const path =
      "/v1/organizations/{organization_id}/claims/{claim_id}/document-uploads/{upload_id}/complete" as const;
    const document = documentFixture();
    server.use(mock.post(path, ({ respond }) => respond(200, document))); // completed before

    const repeat = await client.request("post", path, {
      path: { organization_id: ORG, claim_id: CLAIM, upload_id: document.id },
    });

    expect(repeat.status).toBe(200);
  });

  test("the query string is parsed, repeated keys included", async () => {
    let statuses: string[] = [];
    server.use(
      mock.get("/v1/organizations/{organization_id}/claims", ({ query }) => {
        statuses = query.getAll("status");
        return { items: [], next_cursor: null, has_more: false };
      }),
    );

    await client.get("/v1/organizations/{organization_id}/claims", {
      path: { organization_id: ORG },
      query: { status: ["new", "inspected"] },
    });

    expect(statuses).toEqual(["new", "inspected"]);
  });
});

describe("the contract", () => {
  test("an answer it doesn't allow fails loudly, naming the field", async () => {
    server.use(
      mock.get(
        "/v1/organizations/{organization_id}",
        () =>
          // A mock gone stale: the API renamed `timezone` and this still sends a number.
          ({ ...organization(), timezone: 5 }) as unknown as Schema<"OrganizationRead">,
      ),
    );

    const error = await client
      .get("/v1/organizations/{organization_id}", { path: { organization_id: ORG } })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, code: "mock_contract_violation" });
    expect((error as ApiError).problem.detail).toContain("timezone");
    expect((error as ApiError).problem.detail).toContain("get /v1/organizations/{organization_id}");
  });

  test("a request body it refuses gets the API's 422, and the resolver isn't called", async () => {
    let called = false;
    server.use(
      mock.post("/v1/organizations", ({ body }) => {
        called = true;
        return organization({ name: body.name });
      }),
    );

    const error = await client
      .request("post", "/v1/organizations", { body: { name: "" } })
      .catch((e: unknown) => e);

    expect(called).toBe(false);
    expect(error).toMatchObject({ status: 422, code: "validation_failed" });
    expect((error as ApiError).fieldErrors).toEqual([
      expect.objectContaining({ loc: ["body", "name"] }),
    ]);
  });

  test("a hand-built Response goes out as it is", async () => {
    server.use(
      mock.get("/v1/organizations/{organization_id}", () =>
        HttpResponse.json({ deliberately: "broken" }, { status: 200 }),
      ),
    );

    const error = await client
      .get("/v1/organizations/{organization_id}", { path: { organization_id: ORG } })
      .catch((e: unknown) => e);

    // Not rewritten into a mock_contract_violation: the client's own check catches it.
    expect(error).toBeInstanceOf(ResponseValidationError);
  });

  test("types keep mocks to real paths, methods and bodies", () => {
    // @ts-expect-error: no such path
    mock.get("/v1/organisations", () => undefined);
    // @ts-expect-error: organizations can't be PUT
    mock.put("/v1/organizations/{organization_id}", () => undefined);
    // @ts-expect-error: the body is an organization, not a string
    mock.get("/v1/organizations/{organization_id}", () => "Lone Star");
    expect(true).toBe(true);
  });
});

describe("problem()", () => {
  test("builds errors the client reads as the API's", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims/{claim_id}/status", () =>
        problem(409, "status_changed", { detail: "The claim is inspected now, not new" }),
      ),
    );

    const error = await client
      .post("/v1/organizations/{organization_id}/claims/{claim_id}/status", {
        path: { organization_id: ORG, claim_id: CLAIM },
        body: { status: "cancelled", expected_status: "new" },
      })
      .catch((e: unknown) => e);

    expect(isApiError(error, "status_changed")).toBe(true);
    expect(error).toMatchObject({
      status: 409,
      problem: {
        type: "https://claimforge.dev/problems/status-changed",
        detail: "The claim is inspected now, not new",
      },
    });
  });
});
