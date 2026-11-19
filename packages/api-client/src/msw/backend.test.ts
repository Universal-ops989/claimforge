import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { fixtureId, ids, people, rolePermissions } from "../fixtures";
import {
  createApiClient,
  memoryTokenStore,
  type ApiClient,
  type ApiError,
  type QueryParams,
  type RequestBody,
} from "../index";
import { createMockBackend, MOCK_PASSWORD } from "./index";

let clock = Date.parse("2026-11-16T12:00:00Z");
const backend = createMockBackend({ baseUrl: "https://api.test", now: () => clock });
const server = setupServer(...backend.handlers);

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  backend.reset();
  clock = Date.parse("2026-11-16T12:00:00Z");
});
afterAll(() => {
  server.close();
});

const ORG = { organization_id: ids.organization };
const CLAIM = { ...ORG, claim_id: ids.claim };

function client(expired: () => void = () => undefined) {
  const tokens = memoryTokenStore();
  const api = createApiClient({
    baseUrl: "https://api.test",
    auth: { tokens, now: () => clock, onSessionExpired: expired },
  });
  return { api, tokens };
}

async function signedIn(email = "morgan@example.com"): Promise<ApiClient> {
  const { api } = client();
  await api.login({ email, password: MOCK_PASSWORD });
  return api;
}

const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected a refusal");
    },
    (error: unknown) => error as ApiError,
  );

describe("sessions", () => {
  test("a wrong password is refused; the right one signs in", async () => {
    const { api } = client();

    const wrong = await refusal(api.login({ email: "morgan@example.com", password: "nope" }));
    await api.login({ email: "Morgan@Example.com", password: MOCK_PASSWORD });
    const me = await api.get("/v1/me");

    expect(wrong).toMatchObject({ status: 401, code: "invalid_credentials" });
    expect(me.full_name).toBe("Morgan Member");
  });

  test("nothing but auth answers without a token", async () => {
    const error = await refusal(client().api.get("/v1/me"));

    expect(error).toMatchObject({ status: 401, code: "authentication_required" });
  });

  test("an expired access token is refreshed, the refresh token rotating", async () => {
    const { api, tokens } = client();
    await api.login({ email: "morgan@example.com", password: MOCK_PASSWORD });
    const first = await tokens.get();

    clock += 901_000; // past the access token's 15 minutes
    await api.get("/v1/me");

    const second = await tokens.get();
    expect(second?.refreshToken).not.toBe(first?.refreshToken);
  });

  test("an access token stops working after its 15 minutes", async () => {
    const { api, tokens } = client();
    await api.login({ email: "morgan@example.com", password: MOCK_PASSWORD });
    const access = (await tokens.get())?.accessToken ?? "";
    const me = () =>
      fetch("https://api.test/v1/me", { headers: { Authorization: `Bearer ${access}` } });

    const fresh = await me();
    clock += 901_000;
    const stale = await me();

    expect(fresh.status).toBe(200);
    expect(stale.status).toBe(401);
  });

  test("presenting a used refresh token ends the session for everyone holding it", async () => {
    let expired = false;
    const { api, tokens } = client(() => {
      expired = true;
    });
    await api.login({ email: "morgan@example.com", password: MOCK_PASSWORD });
    const stolen = (await tokens.get())?.refreshToken ?? "";
    clock += 901_000;
    await api.get("/v1/me"); // the client rotates: `stolen` is now used

    const replay = await refusal(api.post("/v1/auth/refresh", { body: { refresh_token: stolen } }));
    clock += 901_000;
    const after = await refusal(api.get("/v1/me"));

    expect(replay).toMatchObject({ code: "refresh_token_reused" });
    expect(after).toMatchObject({ code: "authentication_required" });
    expect(expired).toBe(true);
  });

  test("logging out revokes the session", async () => {
    const { api, tokens } = client();
    await api.login({ email: "morgan@example.com", password: MOCK_PASSWORD });
    const held = await tokens.get();

    await api.logout();
    const reuse = await refusal(
      api.post("/v1/auth/refresh", { body: { refresh_token: held?.refreshToken ?? "" } }),
    );

    expect(reuse).toMatchObject({ code: "invalid_refresh_token" });
  });
});

describe("claims", () => {
  test("lists filter, search, sort and page", async () => {
    const api = await signedIn();
    const list = (query: QueryParams<"/v1/organizations/{organization_id}/claims", "get"> = {}) =>
      api.get("/v1/organizations/{organization_id}/claims", { path: ORG, query });

    const all = await list();
    const inspected = await list({ status: ["inspected"] });
    const found = await list({ q: "congress" });
    const oldestFirst = await list({ sort: "created_at", limit: 1 });
    const next = await list({
      sort: "created_at",
      limit: 1,
      cursor: oldestFirst.next_cursor ?? "",
    });

    expect(all.items.map((c) => c.number)).toEqual(["2026-00042", "2026-00041"]); // newest first
    expect(inspected.items.map((c) => c.number)).toEqual(["2026-00041"]);
    expect(found.items).toHaveLength(2); // both are at 100 Congress Ave
    expect(oldestFirst).toMatchObject({ has_more: true, items: [{ number: "2026-00041" }] });
    expect(next).toMatchObject({ has_more: false, items: [{ number: "2026-00042" }] });
  });

  test("a new claim is numbered next and listed first", async () => {
    const api = await signedIn();

    const created = await api.post("/v1/organizations/{organization_id}/claims", {
      path: ORG,
      body: {
        loss_type: "mold",
        property: { address: { line1: "5 Elm St", city: "Round Rock", region: "TX" } },
      },
    });
    const list = await api.get("/v1/organizations/{organization_id}/claims", { path: ORG });
    const byNumber = await api.get(
      "/v1/organizations/{organization_id}/claims/by-number/{number}",
      {
        path: { ...ORG, number: "2026-00043" },
      },
    );

    expect(created).toMatchObject({
      number: "2026-00043",
      status: "new",
      property: { address: { formatted: "5 Elm St, Round Rock, TX" } },
    });
    expect(list.items[0]?.id).toBe(created.id);
    expect(byNumber.id).toBe(created.id);
  });

  test("a claim needs exactly one of property_id and property", async () => {
    const api = await signedIn();

    const neither = await refusal(
      api.post("/v1/organizations/{organization_id}/claims", {
        path: ORG,
        body: { loss_type: "water" },
      }),
    );

    expect(neither).toMatchObject({ status: 422, code: "validation_failed" });
  });

  test("another organization's claims are not found", async () => {
    const api = await signedIn();

    const error = await refusal(
      api.get("/v1/organizations/{organization_id}/claims", {
        path: { organization_id: fixtureId("organization", 9) },
      }),
    );

    expect(error).toMatchObject({ status: 404 });
  });
});

describe("the status workflow", () => {
  const move = (
    api: ApiClient,
    body: RequestBody<"/v1/organizations/{organization_id}/claims/{claim_id}/status", "post">,
  ) =>
    api.post("/v1/organizations/{organization_id}/claims/{claim_id}/status", { path: CLAIM, body });

  test("follows the contract's workflow, history and timeline included", async () => {
    const api = await signedIn();

    const skipped = await refusal(move(api, { status: "completed" }));
    const moved = await move(api, { status: "inspected", expected_status: "new" });
    const history = await api.get(
      "/v1/organizations/{organization_id}/claims/{claim_id}/status-history",
      { path: CLAIM },
    );
    const timeline = await api.get(
      "/v1/organizations/{organization_id}/claims/{claim_id}/timeline",
      { path: CLAIM },
    );

    expect(skipped).toMatchObject({ status: 422, code: "invalid_status_transition" });
    expect(skipped.problem).toMatchObject({
      allowed: ["inspected", "in_progress", "on_hold", "cancelled"],
    });
    expect(moved).toMatchObject({
      status: "inspected",
      next_statuses: ["in_progress", "on_hold", "cancelled"],
    });
    expect(history.map((c) => [c.from_status, c.to_status, c.changed_by?.id])).toEqual([
      ["new", "inspected", people.morgan.id],
    ]);
    expect(timeline.items[0]).toMatchObject({ kind: "status", actor: people.morgan });
  });

  test("a stale view is refused, and some moves need a reason", async () => {
    const api = await signedIn();
    await move(api, { status: "inspected" });

    const stale = await refusal(move(api, { status: "cancelled", expected_status: "new" }));
    const why = await refusal(move(api, { status: "on_hold" }));
    const held = await move(api, { status: "on_hold", reason: "Waiting on the carrier" });

    expect(stale).toMatchObject({ status: 409, code: "status_changed" });
    expect(why).toMatchObject({ status: 422, code: "reason_required" });
    expect(held.status).toBe("on_hold");
  });

  test("a cancelled claim is locked, and only a supervisor reinstates it", async () => {
    const morgan = await signedIn();
    await move(morgan, { status: "cancelled", reason: "Duplicate" });
    // Riley as an adjuster: may change claims, may not reopen them.
    const membership = backend.db.accounts.find((a) => a.user.id === people.riley.id)?.user
      .memberships[0];
    Object.assign(membership ?? {}, {
      role: "adjuster",
      permissions: rolePermissions.adjuster,
    });
    const riley = await signedIn("riley@example.com");

    const edit = await refusal(
      morgan.patch("/v1/organizations/{organization_id}/claims/{claim_id}", {
        path: CLAIM,
        body: { description: "Changed my mind" },
      }),
    );
    const byTech = await refusal(move(riley, { status: "new", reason: "Not a duplicate" }));
    const byOwner = await move(morgan, { status: "new", reason: "Not a duplicate" });

    expect(edit).toMatchObject({ status: 409, code: "claim_locked" });
    expect(byTech).toMatchObject({ status: 403, code: "permission_denied" });
    expect(byOwner.status).toBe("new");
  });
});

describe("tasks and notes", () => {
  const TASKS = "/v1/organizations/{organization_id}/claims/{claim_id}/tasks" as const;

  test("tasks list open first, soonest due first; done ones sink", async () => {
    const api = await signedIn();
    const urgent = await api.post(TASKS, {
      path: CLAIM,
      body: { title: "Call the adjuster", due_on: "2026-11-17", assignee_id: people.riley.id },
    });

    const before = await api.get(TASKS, { path: CLAIM });
    await api.patch(`${TASKS}/{task_id}`, {
      path: { ...CLAIM, task_id: urgent.id },
      body: { done: true },
    });
    const after = await api.get(TASKS, { path: CLAIM });
    const riley = await signedIn("riley@example.com");
    const rileys = await riley.get("/v1/organizations/{organization_id}/tasks/assigned-to-me", {
      path: ORG,
      query: { status: "open" },
    });

    expect(before.map((t) => t.title)).toEqual(["Call the adjuster", "Set dryers in the kitchen"]);
    expect(after.map((t) => [t.title, t.done])).toEqual([
      ["Set dryers in the kitchen", false],
      ["Call the adjuster", true],
    ]);
    expect(after[1]?.completed_by_id).toBe(people.morgan.id);
    expect(rileys.items.map((t) => t.title)).toEqual(["Set dryers in the kitchen"]);
  });

  test("notes render mentions, and only the author edits", async () => {
    const riley = await signedIn("riley@example.com");
    const morgan = await signedIn();
    const NOTES = "/v1/organizations/{organization_id}/claims/{claim_id}/notes" as const;

    const written = await morgan.post(NOTES, {
      path: CLAIM,
      body: { body: `<@${people.riley.id}> can you photograph the vent?` },
    });
    const notYours = await refusal(
      riley.patch(`${NOTES}/{note_id}`, {
        path: { ...CLAIM, note_id: written.id },
        body: { body: "Rewritten" },
      }),
    );
    const mine = await riley.get("/v1/organizations/{organization_id}/notes/mentioning-me", {
      path: ORG,
    });
    const unknown = await refusal(
      morgan.post(NOTES, { path: CLAIM, body: { body: `<@${fixtureId("person", 9)}> hi` } }),
    );

    expect(written).toMatchObject({
      text: "@Riley Tech can you photograph the vent?",
      mentions: [people.riley],
    });
    expect(notYours).toMatchObject({ status: 403, code: "not_note_author" });
    expect(mine.items.map((n) => n.id)).toEqual([written.id]);
    expect(unknown).toMatchObject({ status: 422, code: "unknown_mention" });
  });
});

test("reset() puts the seed back", async () => {
  const api = await signedIn();
  await api.post("/v1/organizations/{organization_id}/claims", {
    path: ORG,
    body: { loss_type: "wind", property_id: backend.db.claims[0]?.claim.property.id ?? "" },
  });
  expect(backend.db.claims).toHaveLength(3);

  backend.reset();

  expect(backend.db.claims).toHaveLength(2);
});

describe("assignments", () => {
  const ASSIGN = "/v1/organizations/{organization_id}/claims/{claim_id}/assignments" as const;
  const assign = (
    api: ApiClient,
    user_id: string,
    role: "adjuster" | "field_technician" | "contractor",
  ) => api.post(ASSIGN, { path: CLAIM, body: { user_id, role } });
  const claimNow = (api: ApiClient) =>
    api.get("/v1/organizations/{organization_id}/claims/{claim_id}", { path: CLAIM });

  test("assigning puts the member on the claim, and the list shows the adjuster", async () => {
    const api = await signedIn();

    const tech = await assign(api, people.riley.id, "field_technician");
    await assign(api, people.morgan.id, "adjuster");
    const claim = await claimNow(api);
    const list = await api.get("/v1/organizations/{organization_id}/claims", { path: ORG });
    const timeline = await api.get(
      "/v1/organizations/{organization_id}/claims/{claim_id}/timeline",
      {
        path: CLAIM,
      },
    );

    expect(tech).toMatchObject({
      user: people.riley,
      role: "field_technician",
      assigned_by_id: people.morgan.id,
    });
    expect(claim.assignments.map((a) => [a.user.full_name, a.role])).toEqual([
      ["Riley Tech", "field_technician"],
      ["Morgan Member", "adjuster"],
    ]);
    expect(list.items.find((c) => c.id === ids.claim)?.adjuster).toEqual(people.morgan);
    expect(timeline.items.filter((e) => e.kind === "team")).toHaveLength(2);
  });

  test("a new adjuster replaces the last: one per claim", async () => {
    const membership = backend.db.accounts.find((a) => a.user.id === people.riley.id)?.user
      .memberships[0];
    Object.assign(membership ?? {}, { role: "adjuster", permissions: rolePermissions.adjuster });
    const api = await signedIn();
    await assign(api, people.morgan.id, "adjuster");

    await assign(api, people.riley.id, "adjuster");

    expect((await claimNow(api)).assignments.map((a) => a.user.id)).toEqual([people.riley.id]);
  });

  test("the assignee must be a member, allowed what the role needs", async () => {
    const api = await signedIn();

    const stranger = await refusal(assign(api, fixtureId("person", 9), "contractor"));
    const techAsAdjuster = await refusal(assign(api, people.riley.id, "adjuster"));

    expect(stranger).toMatchObject({ status: 422, code: "unknown_assignee" });
    expect(techAsAdjuster).toMatchObject({ status: 422, code: "assignee_lacks_permission" });
    expect(techAsAdjuster.problem).toMatchObject({ assignee_needs: "claims:write" });
  });

  test("someone already on the claim must come off before changing role", async () => {
    const api = await signedIn();
    await assign(api, people.riley.id, "field_technician");

    const again = await refusal(assign(api, people.riley.id, "contractor"));

    expect(again).toMatchObject({ status: 409, code: "already_assigned" });
  });

  test("only someone who can change claims assigns, and not on a locked claim", async () => {
    const riley = await signedIn("riley@example.com");
    const byTech = await refusal(assign(riley, people.riley.id, "field_technician"));
    const morgan = await signedIn();
    await morgan.post("/v1/organizations/{organization_id}/claims/{claim_id}/status", {
      path: CLAIM,
      body: { status: "cancelled", reason: "Duplicate" },
    });

    const onLocked = await refusal(assign(morgan, people.riley.id, "field_technician"));

    expect(byTech).toMatchObject({ status: 403, code: "permission_denied" });
    expect(onLocked).toMatchObject({ status: 409, code: "claim_locked" });
  });

  test("unassigning takes the member off; someone not on the claim is not found", async () => {
    const api = await signedIn();
    await assign(api, people.riley.id, "field_technician");
    const path = { ...CLAIM, user_id: people.riley.id };

    await api.delete(`${ASSIGN}/{user_id}`, { path });
    const twice = await refusal(api.delete(`${ASSIGN}/{user_id}`, { path }));

    expect((await claimNow(api)).assignments).toEqual([]);
    expect(twice).toMatchObject({ status: 404 });
  });
});

describe("members", () => {
  const MEMBERS = "/v1/organizations/{organization_id}/members" as const;

  test("lists the organization's members by name, with role and permissions", async () => {
    const api = await signedIn("riley@example.com");

    const members = await api.get(MEMBERS, { path: ORG });

    expect(members.map((m) => [m.user.full_name, m.role])).toEqual([
      ["Morgan Member", "owner"],
      ["Riley Tech", "technician"],
    ]);
    expect(members[1]?.user).toEqual(people.riley);
    expect(members[1]?.permissions).toEqual([...rolePermissions.technician].sort());
    expect(JSON.stringify(members)).not.toContain("@");
  });

  test("outsiders get a 404", async () => {
    backend.db.accounts.push({
      email: "outsider@example.com",
      password: MOCK_PASSWORD,
      user: {
        id: fixtureId("person", 9),
        email: "outsider@example.com",
        full_name: "Out Sider",
        memberships: [],
      },
    });
    const api = await signedIn("outsider@example.com");

    const refused = await refusal(api.get(MEMBERS, { path: ORG }));

    expect(refused.status).toBe(404);
  });
});
