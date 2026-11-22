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
import {
  defaultTitle,
  dewPointF,
  equipmentDays,
  grainsPerPound,
  percentText,
  REPORT_MS,
} from "./backend";
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

describe("contacts", () => {
  const CONTACTS = "/v1/organizations/{organization_id}/contacts" as const;
  const CONTACT = "/v1/organizations/{organization_id}/contacts/{contact_id}" as const;
  const LINKS = "/v1/organizations/{organization_id}/claims/{claim_id}/contacts" as const;
  const LINK =
    "/v1/organizations/{organization_id}/claims/{claim_id}/contacts/{contact_id}" as const;
  const jordan = fixtureId("contact");
  const casey = fixtureId("contact", 2);
  const names = (page: { items: { full_name: string }[] }) => page.items.map((c) => c.full_name);
  const claimNow = (api: ApiClient) =>
    api.get("/v1/organizations/{organization_id}/claims/{claim_id}", { path: CLAIM });
  const linked = async (api: ApiClient) =>
    (await claimNow(api)).contacts.map((c) => [c.contact.full_name, c.role, c.is_primary]);

  test("the address book is alphabetical, and searches names, companies, emails and phones", async () => {
    const api = await signedIn();
    const search = (query: QueryParams<typeof CONTACTS, "get">) =>
      api.get(CONTACTS, { path: ORG, query });

    expect(names(await search({}))).toEqual(["Casey Brooks", "Jordan Rivera"]);
    expect(names(await search({ q: "brooks agency" }))).toEqual([]);
    expect(names(await search({ q: "Brooks Insurance" }))).toEqual(["Casey Brooks"]);
    expect(names(await search({ q: "JORDAN.RIVERA@" }))).toEqual(["Jordan Rivera"]);
    expect(names(await search({ q: "555-0142" }))).toEqual(["Jordan Rivera"]);
    expect(names(await search({ kind: "insurance_agent" }))).toEqual(["Casey Brooks"]);
  });

  test("adding a contact keeps the phone number one way, and needs a way to reach them", async () => {
    const api = await signedIn();

    const added = await api.post(CONTACTS, {
      path: ORG,
      body: { full_name: "Sam Tenant", kind: "tenant", phone: "(512) 555-0100" },
    });
    const unreachable = await refusal(
      api.post(CONTACTS, {
        path: ORG,
        body: { full_name: "No Email", preferred_contact_method: "email" },
      }),
    );

    expect(added.phone).toBe("+15125550100");
    expect(unreachable.code).toBe("contact_method_unavailable");
  });

  test("changing the address book takes contacts:write", async () => {
    const api = await signedIn("riley@example.com");

    const refused = await refusal(api.post(CONTACTS, { path: ORG, body: { full_name: "X" } }));

    expect(refused.status).toBe(403);
    expect(names(await api.get(CONTACTS, { path: ORG }))).toHaveLength(2);
  });

  test("a changed contact shows the change on the claims it's on", async () => {
    const api = await signedIn();

    await api.patch(CONTACT, {
      path: { ...ORG, contact_id: jordan },
      body: { phone: "512 555 0177", company_name: null },
    });

    expect((await claimNow(api)).contacts[0]?.contact.phone).toBe("+15125550177");
  });

  test("a deleted contact leaves the address book but stays on its claims", async () => {
    const api = await signedIn();

    await api.delete(CONTACT, { path: { ...ORG, contact_id: jordan } });

    expect(names(await api.get(CONTACTS, { path: ORG }))).toEqual(["Casey Brooks"]);
    expect(await linked(api)).toEqual([["Jordan Rivera", "insured", true]]);
  });

  test("linking a contact as primary makes them the only primary one", async () => {
    const api = await signedIn();

    await api.post(LINKS, {
      path: CLAIM,
      body: { contact_id: casey, role: "insurance_agent", is_primary: true },
    });

    expect(await linked(api)).toEqual([
      ["Jordan Rivera", "insured", false],
      ["Casey Brooks", "insurance_agent", true],
    ]);
    const timeline = await api.get(
      "/v1/organizations/{organization_id}/claims/{claim_id}/timeline",
      { path: CLAIM },
    );
    expect(timeline.items[0]?.summary).toBe("Added Casey Brooks as insurance agent");
  });

  test("links are refused as the API refuses them", async () => {
    const api = await signedIn();

    const twice = await refusal(
      api.post(LINKS, { path: CLAIM, body: { contact_id: jordan, role: "tenant" } }),
    );
    const unknown = await refusal(
      api.post(LINKS, {
        path: CLAIM,
        body: { contact_id: fixtureId("contact", 9), role: "other" },
      }),
    );
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    const locked = await refusal(
      api.post(LINKS, { path: CLAIM, body: { contact_id: casey, role: "insurance_agent" } }),
    );

    expect([twice.code, unknown.code, locked.code]).toEqual([
      "contact_already_linked",
      "unknown_contact",
      "claim_locked",
    ]);
  });

  test("a link's role and primary can change, and the link can go", async () => {
    const api = await signedIn();
    await api.post(LINKS, { path: CLAIM, body: { contact_id: casey, role: "other" } });

    await api.patch(LINK, {
      path: { ...CLAIM, contact_id: casey },
      body: { role: "insurance_agent", is_primary: true },
    });
    expect(await linked(api)).toEqual([
      ["Jordan Rivera", "insured", false],
      ["Casey Brooks", "insurance_agent", true],
    ]);

    await api.delete(LINK, { path: { ...CLAIM, contact_id: jordan } });
    expect(await linked(api)).toEqual([["Casey Brooks", "insurance_agent", true]]);
  });
});

describe("the layout", () => {
  const STRUCTURES = "/v1/organizations/{organization_id}/claims/{claim_id}/structures" as const;
  const STRUCTURE = `${STRUCTURES}/{structure_id}` as const;
  const ROOMS = `${STRUCTURE}/rooms` as const;
  const ROOM = "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}" as const;
  const DAMAGE = "/v1/organizations/{organization_id}/claims/{claim_id}/damage-items" as const;
  const layout = (api: ApiClient) => api.get(STRUCTURES, { path: CLAIM });

  test("structures and rooms are added in order, with measures worked out", async () => {
    const api = await signedIn("riley@example.com");

    const garage = await api.post(STRUCTURES, { path: CLAIM, body: { name: "Garage" } });
    const room = await api.post(ROOMS, {
      path: { ...CLAIM, structure_id: garage.id },
      body: { name: "Workshop", length_ft: 20, width_ft: 12.5, height_ft: 9 },
    });

    expect(room).toMatchObject({ floor_area_sqft: 250, wall_area_sqft: 585, volume_cuft: 2250 });
    expect((await layout(api)).map((s) => [s.name, s.rooms.map((r) => r.name)])).toEqual([
      ["House", ["Kitchen"]],
      ["Garage", ["Workshop"]],
    ]);
  });

  test("names are unique, ignoring case", async () => {
    const api = await signedIn();

    const structure = await refusal(api.post(STRUCTURES, { path: CLAIM, body: { name: "house" } }));
    const room = await refusal(
      api.post(ROOMS, {
        path: { ...CLAIM, structure_id: ids.structure },
        body: { name: "KITCHEN" },
      }),
    );

    expect([structure.code, room.code]).toEqual(["name_taken", "name_taken"]);
  });

  test("a room is re-measured, cleared or moved", async () => {
    const api = await signedIn();
    const garage = await api.post(STRUCTURES, { path: CLAIM, body: { name: "Garage" } });

    const remeasured = await api.patch(ROOM, {
      path: { ...CLAIM, room_id: ids.room },
      body: { length_ft: 15, height_ft: null },
    });
    const moved = await api.patch(ROOM, {
      path: { ...CLAIM, room_id: ids.room },
      body: { structure_id: garage.id },
    });
    const nowhere = await refusal(
      api.patch(ROOM, {
        path: { ...CLAIM, room_id: ids.room },
        body: { structure_id: fixtureId("structure", 9) },
      }),
    );

    expect(remeasured).toMatchObject({
      floor_area_sqft: 150,
      wall_area_sqft: null,
      volume_cuft: null,
    });
    expect(moved.structure_id).toBe(garage.id);
    expect((await layout(api)).map((s) => s.rooms.length)).toEqual([0, 1]);
    expect(nowhere.code).toBe("unknown_structure");
  });

  test("deleting a room or structure takes its damage with it", async () => {
    backend.db.moisturePoints = []; // drying records would keep the room
    const api = await signedIn();

    await api.delete(ROOM, { path: { ...CLAIM, room_id: ids.room } });
    expect(await api.get(DAMAGE, { path: CLAIM })).toEqual([]);

    await api.delete(STRUCTURE, { path: { ...CLAIM, structure_id: ids.structure } });
    expect(await layout(api)).toEqual([]);
  });

  test("a closed claim's layout can't change", async () => {
    const api = await signedIn();
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";

    const locked = await refusal(api.post(STRUCTURES, { path: CLAIM, body: { name: "Shed" } }));

    expect(locked.code).toBe("claim_locked");
  });
});

describe("damage", () => {
  const DAMAGE = "/v1/organizations/{organization_id}/claims/{claim_id}/damage-items" as const;
  const ITEM = `${DAMAGE}/{damage_item_id}` as const;
  const RECORD =
    "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}/damage-items" as const;
  const inKitchen = { ...CLAIM, room_id: ids.room };

  test("recorded damage takes the claim's cause unless told, and lists by room", async () => {
    const api = await signedIn("riley@example.com");

    const item = await api.post(RECORD, {
      path: inKitchen,
      body: { surface: "wall", material: "Drywall", water_category: 2, water_class: 2 },
    });
    const items = await api.get(DAMAGE, { path: CLAIM });

    expect(item).toMatchObject({
      cause: "water",
      water_category: 2,
      created_by_id: people.riley.id,
    });
    expect(items.map((i) => i.material)).toEqual(["Laminate", "Drywall"]);
    expect(await api.get(DAMAGE, { path: CLAIM, query: { cause: "fire" } })).toEqual([]);
  });

  test("water details follow the cause, as the API has them", async () => {
    const api = await signedIn();

    const sewage = await api.post(RECORD, {
      path: inKitchen,
      body: { surface: "floor", material: "Carpet", cause: "sewage" },
    });
    const notWater = await refusal(
      api.post(RECORD, {
        path: inKitchen,
        body: { surface: "wall", material: "Paint", cause: "smoke", water_category: 1 },
      }),
    );
    const notBlack = await refusal(
      api.post(RECORD, {
        path: inKitchen,
        body: { surface: "floor", material: "Tile", cause: "flood", water_category: 1 },
      }),
    );

    expect(sewage.water_category).toBe(3);
    expect([notWater.code, notBlack.code]).toEqual(["not_water_damage", "black_water_category"]);
  });

  test("damage can change, move rooms, and go", async () => {
    const api = await signedIn();
    const pantry = await api.post(
      "/v1/organizations/{organization_id}/claims/{claim_id}/structures/{structure_id}/rooms",
      { path: { ...CLAIM, structure_id: ids.structure }, body: { name: "Pantry" } },
    );

    const changed = await api.patch(ITEM, {
      path: { ...CLAIM, damage_item_id: ids.damage },
      body: { room_id: pantry.id, description: null, water_class: 3 },
    });
    const lost = await refusal(
      api.patch(ITEM, {
        path: { ...CLAIM, damage_item_id: ids.damage },
        body: { room_id: fixtureId("room", 9) },
      }),
    );
    await api.delete(ITEM, { path: { ...CLAIM, damage_item_id: ids.damage } });

    expect(changed).toMatchObject({ room_id: pantry.id, description: null, water_class: 3 });
    expect(lost.code).toBe("unknown_room");
    expect(await api.get(DAMAGE, { path: CLAIM })).toEqual([]);
  });
});

describe("photos", () => {
  const UPLOADS = "/v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads" as const;
  const PHOTOS = "/v1/organizations/{organization_id}/claims/{claim_id}/photos" as const;
  const PHOTO = `${PHOTOS}/{photo_id}` as const;
  const jpeg = (size = 1200) => new Blob([new Uint8Array(size)], { type: "image/jpeg" });

  async function upload(
    api: ApiClient,
    file: Blob,
    details: Partial<RequestBody<typeof UPLOADS, "post">> = {},
  ) {
    const started = await api.post(UPLOADS, {
      path: CLAIM,
      body: {
        filename: "IMG_1.jpg",
        content_type: "image/jpeg",
        size_bytes: file.size,
        ...details,
      },
    });
    await api.sendFile(started.upload, file);
    return {
      started,
      photo: await api.post(`${UPLOADS}/{upload_id}/complete`, {
        path: { ...CLAIM, upload_id: started.id },
      }),
    };
  }

  test("an upload goes up, becomes a photo, and its file comes back", async () => {
    const api = await signedIn("riley@example.com");

    const { photo } = await upload(api, jpeg(), {
      caption: "  Ceiling stain ",
      tags: ["Before", "ceiling", "before"],
      room_id: ids.room,
    });
    const file = await fetch(photo.url);

    expect(photo).toMatchObject({
      caption: "Ceiling stain",
      tags: ["before", "ceiling"],
      room: { id: ids.room, name: "Kitchen" },
      uploaded_by: people.riley,
      processing: "ready",
    });
    expect((await file.blob()).size).toBe(1200);
  });

  test("completing is refused until the file is sent, or when it isn't the one described", async () => {
    const api = await signedIn();
    const started = await api.post(UPLOADS, {
      path: CLAIM,
      body: { filename: "a.jpg", content_type: "image/jpeg", size_bytes: 10 },
    });
    const complete = () =>
      api.post(`${UPLOADS}/{upload_id}/complete`, { path: { ...CLAIM, upload_id: started.id } });

    const early = await refusal(complete());
    await api.sendFile(started.upload, jpeg(11));
    const mismatch = await refusal(complete());
    await api.sendFile(started.upload, jpeg(10));
    const photo = await complete();
    const again = await complete();

    expect([early.code, mismatch.code]).toEqual(["upload_not_received", "upload_mismatch"]);
    expect(again.id).toBe(photo.id);
  });

  test("too large, or for a room elsewhere, is refused at the start", async () => {
    const api = await signedIn();
    const start = (body: Partial<RequestBody<typeof UPLOADS, "post">>) =>
      refusal(
        api.post(UPLOADS, {
          path: CLAIM,
          body: { filename: "a.jpg", content_type: "image/jpeg", size_bytes: 10, ...body },
        }),
      );

    const big = await start({ size_bytes: 26 * 1024 * 1024 });
    const elsewhere = await start({ room_id: fixtureId("room", 9) });

    expect([big.code, elsewhere.code]).toEqual(["photo_too_large", "unknown_room"]);
  });

  test("lists newest first, by room, unassigned, or by every tag given", async () => {
    const api = await signedIn();
    await upload(api, jpeg(), { tags: ["after"] });
    const list = (query: QueryParams<typeof PHOTOS, "get">) =>
      api.get(PHOTOS, { path: CLAIM, query }).then((page) => page.items.map((p) => p.tags));

    expect(await list({})).toEqual([["after"], ["before", "ceiling"]]);
    expect(await list({ room_id: ids.room })).toEqual([["before", "ceiling"]]);
    expect(await list({ unassigned: true })).toEqual([["after"]]);
    expect(await list({ tag: ["before", "ceiling"] })).toHaveLength(1);
    expect(await list({ tag: ["before", "after"] })).toEqual([]);
  });

  test("editing clears a blank caption, tidies tags, and can take it out of its room", async () => {
    const api = await signedIn();

    const edited = await api.patch(PHOTO, {
      path: { ...CLAIM, photo_id: ids.photo },
      body: { caption: "  ", tags: ["Water Line", "after"], room_id: null },
    });

    expect(edited).toMatchObject({ caption: null, tags: ["after", "water line"], room: null });
  });

  test("a photo follows its room: renamed with it, unassigned when it goes", async () => {
    backend.db.moisturePoints = []; // drying records would keep the room
    const api = await signedIn();
    const ROOM = "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}" as const;
    const photoNow = () => api.get(PHOTO, { path: { ...CLAIM, photo_id: ids.photo } });

    await api.patch(ROOM, { path: { ...CLAIM, room_id: ids.room }, body: { name: "Galley" } });
    expect((await photoNow()).room?.name).toBe("Galley");

    await api.delete(ROOM, { path: { ...CLAIM, room_id: ids.room } });
    expect((await photoNow()).room).toBeNull();
  });

  test("tag suggestions count the photos carrying each, most used first", async () => {
    const api = await signedIn();
    await upload(api, jpeg(), { tags: ["before", "wall"] });
    const TAGS = "/v1/organizations/{organization_id}/photo-tags" as const;

    expect(await api.get(TAGS, { path: ORG })).toEqual([
      { tag: "before", photos: 2 },
      { tag: "ceiling", photos: 1 },
      { tag: "wall", photos: 1 },
    ]);
    expect(await api.get(TAGS, { path: ORG, query: { prefix: "w" } })).toEqual([
      { tag: "wall", photos: 1 },
    ]);
  });

  test("a seeded photo is served from the pretend store, drawn", async () => {
    const api = await signedIn();

    const seeded = await api.get(PHOTO, { path: { ...CLAIM, photo_id: ids.photo } });
    const file = await fetch(seeded.thumbnail_url ?? "");

    expect(seeded.url).toBe(`https://api.test/__mock-storage/files/${ids.photo}`);
    expect(file.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  test("deleting a photo takes it off the claim", async () => {
    const api = await signedIn();

    await api.delete(PHOTO, { path: { ...CLAIM, photo_id: ids.photo } });

    expect((await api.get(PHOTOS, { path: CLAIM })).items).toEqual([]);
  });
});

describe("the air", () => {
  // The API's own worked figures (apps/api/tests/moisture/test_atmosphere.py).
  test.each([
    [68, 50, 50.8, 48.7],
    [86, 50, 93.2, 65.2],
    [70, 100, 110.3, 70],
  ])("%d °F at %d%% holds %d grains per pound, dew point %d °F", (t, rh, grains, dew) => {
    expect(grainsPerPound(t, rh)).toBe(grains);
    expect(dewPointF(t, rh)).toBe(dew);
  });

  test("bone-dry air has no dew point", () => {
    expect(grainsPerPound(75, 0)).toBe(0);
    expect(dewPointF(75, 0)).toBeNull();
  });
});

describe("moisture", () => {
  const POINTS = "/v1/organizations/{organization_id}/claims/{claim_id}/moisture-points" as const;
  const POINT = `${POINTS}/{point_id}` as const;
  const LOGS = "/v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs" as const;
  const LOG = `${LOGS}/{log_id}` as const;
  const STATUS = "/v1/organizations/{organization_id}/claims/{claim_id}/drying-status" as const;
  const DRYING_LOG = "/v1/organizations/{organization_id}/claims/{claim_id}/drying-log" as const;
  const at = (iso: string) => {
    clock = Date.parse(iso);
    return iso;
  };
  const map = (api: ApiClient, body: Partial<RequestBody<typeof POINTS, "post">> = {}) =>
    api.post(POINTS, {
      path: CLAIM,
      body: { room_id: ids.room, material: "drywall", surface: "wall", scale: "percent", ...body },
    });
  const read = (api: ApiClient, values: [string, number][], taken_at?: string) =>
    api.post(LOGS, {
      path: CLAIM,
      body: { readings: values.map(([point_id, value]) => ({ point_id, value })), taken_at },
    });
  const status = (api: ApiClient) => api.get(STATUS, { path: CLAIM });

  test("points are numbered on, labels unique, listed as people number them", async () => {
    const api = await signedIn("riley@example.com");

    const two = await map(api);
    await map(api, { label: "10" });
    const eleven = await map(api);
    const taken = await refusal(map(api, { label: "2" }));
    const elsewhere = await refusal(map(api, { room_id: fixtureId("room", 9) }));
    const listed = await api.get(POINTS, { path: CLAIM });

    expect([two.label, eleven.label]).toEqual(["2", "11"]);
    expect([taken.code, elsewhere.code]).toEqual(["label_taken", "unknown_room"]);
    expect(listed.map((p) => p.label)).toEqual(["1", "2", "10", "11"]);
    expect(listed[0]?.room).toEqual({ id: ids.room, name: "Kitchen" });
  });

  test("a visit's readings carry labels, and its air is worked out", async () => {
    const api = await signedIn();
    at("2026-11-17T12:00:00Z");

    const visit = await api.post(LOGS, {
      path: CLAIM,
      body: {
        readings: [{ point_id: ids.point, value: 15.04 }],
        atmosphere: [{ location: "outdoors", temperature_f: 68, relative_humidity: 50 }],
      },
    });

    expect(visit.readings).toEqual([{ point_id: ids.point, label: "1", value: 15 }]);
    expect(visit.atmosphere[0]).toMatchObject({ grains_per_pound: 50.8, dew_point_f: 48.7 });
    expect(visit.taken_at).toBe("2026-11-17T12:00:00.000Z");
    const newest = await api.get(LOGS, { path: CLAIM });
    expect(newest.items[0]?.id).toBe(visit.id);
  });

  test("a visit needs readings or air, of points on the claim, not from the future", async () => {
    const api = await signedIn();

    const empty = await refusal(api.post(LOGS, { path: CLAIM, body: {} }));
    const stranger = await refusal(read(api, [[fixtureId("point", 9), 10]]));
    const ahead = await refusal(read(api, [[ids.point, 10]], "2026-11-16T13:00:00Z"));

    expect([empty.code, stranger.code, ahead.code]).toEqual([
      "no_readings",
      "unknown_moisture_point",
      "taken_in_future",
    ]);
  });

  test("a correction sets or removes a point's value, keeping something read", async () => {
    const api = await signedIn();
    const visit = await read(api, [[ids.point, 16]], at("2026-11-17T12:00:00Z"));
    const path = { ...CLAIM, log_id: visit.id };

    const corrected = await api.patch(LOG, {
      path,
      body: { readings: [{ point_id: ids.point, value: 14 }] },
    });
    const emptied = await refusal(
      api.patch(LOG, { path, body: { readings: [{ point_id: ids.point, value: null }] } }),
    );

    expect(corrected.readings[0]?.value).toBe(14);
    expect(corrected.readings_edited_at).not.toBeNull();
    expect(emptied.code).toBe("no_readings");
  });

  test("the drying log has points by room down the side and visits across, oldest first", async () => {
    const api = await signedIn();

    const log = await api.get(DRYING_LOG, { path: CLAIM });

    expect(log.visits.map((v) => v.taken_at)).toEqual([
      "2026-11-14T15:00:00Z",
      "2026-11-15T15:00:00Z",
      "2026-11-16T15:00:00Z",
    ]);
    expect(log.rooms).toEqual([
      expect.objectContaining({
        name: "Kitchen",
        points: [expect.objectContaining({ label: "1", status: "drying", values: [28, 22, 18] })],
      }),
    ]);
    expect(log.atmosphere[0]).toMatchObject({ location: "room", room: { name: "Kitchen" } });
    expect(log.atmosphere[0]?.values).toHaveLength(3);
  });

  test("status counts points as dry, drying, without a goal or not read", async () => {
    const api = await signedIn();
    const goalless = await map(api, { dry_standard: null });
    await map(api);
    at("2026-11-17T12:00:00Z");

    await read(api, [
      [ids.point, 12],
      [goalless.id, 30],
    ]);
    const now = await status(api);

    expect(now.summary).toMatchObject({ points: 3, dry: 1, drying: 0, no_goal: 1, not_read: 1 });
    expect(now.alerts.map((a) => a.kind)).toEqual(["no_goal"]);
  });

  test("a point that stops improving, and a day without a visit, are flagged", async () => {
    const api = await signedIn();
    at("2026-11-17T12:00:00Z");
    await read(api, [[ids.point, 18]]);
    at("2026-11-18T12:00:00Z");
    await read(api, [[ids.point, 19]]);
    at("2026-11-19T18:00:00Z");

    const now = await status(api);

    expect(now.alerts.map((a) => [a.kind, a.point?.label ?? null])).toEqual([
      ["monitoring_gap", null],
      ["stalled", "1"],
    ]);
    expect(now.alerts[0]?.details).toEqual({ hours: 30, drying_points: 1 });
  });

  test("a deleted point takes its readings, not the visits' air; a room with points can't go", async () => {
    const api = await signedIn();

    const kept = await refusal(
      api.delete("/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}", {
        path: { ...CLAIM, room_id: ids.room },
      }),
    );
    await api.delete(POINT, { path: { ...CLAIM, point_id: ids.point } });

    expect(kept.code).toBe("has_moisture_points");
    // The visits stay for their air readings.
    const visits = (await api.get(LOGS, { path: CLAIM })).items;
    expect(visits).toHaveLength(3);
    expect(visits.flatMap((v) => v.readings)).toEqual([]);
  });
});

describe("billable equipment-days", () => {
  test("every started 24 hours counts, and at least one", () => {
    expect(equipmentDays("2026-11-14T16:00:00Z", "2026-11-14T19:00:00Z")).toBe(1);
    expect(equipmentDays("2026-11-14T16:00:00Z", "2026-11-15T17:00:00Z")).toBe(2);
    expect(equipmentDays("2026-11-14T16:00:00Z", "2026-11-14T16:00:00Z")).toBe(1);
  });
});

describe("equipment", () => {
  const FLEET = "/v1/organizations/{organization_id}/equipment" as const;
  const UNIT = `${FLEET}/{equipment_id}` as const;
  const PLACEMENTS =
    "/v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements" as const;
  const PLACEMENT = `${PLACEMENTS}/{placement_id}` as const;
  const DAYS = "/v1/organizations/{organization_id}/claims/{claim_id}/equipment-days" as const;
  const spare = fixtureId("equipment", 3);
  const place = (api: ApiClient, equipment_id: string, placed_at?: string) =>
    api.post(PLACEMENTS, { path: CLAIM, body: { equipment_id, room_id: ids.room, placed_at } });
  const tags = (page: { items: { asset_tag: string }[] }) => page.items.map((u) => u.asset_tag);

  test("the fleet lists by tag, says where each unit runs, and what's free", async () => {
    const api = await signedIn();

    const fleet = await api.get(FLEET, { path: ORG });
    const free = await api.get(FLEET, { path: ORG, query: { available: true } });

    expect(tags(fleet)).toEqual(["AM-01", "AM-02", "DH-01"]);
    expect(fleet.items[2]?.current_placement).toMatchObject({
      claim: { id: ids.claim, number: "2026-00042" },
      room_id: ids.room,
    });
    expect(tags(free)).toEqual(["AM-02"]);
  });

  test("asset tags are unique, capacity goes by kind, worked units can't be deleted", async () => {
    const api = await signedIn("riley@example.com");

    const heater = await api.post(FLEET, {
      path: ORG,
      body: { kind: "heater", name: "Heater", asset_tag: "HT-01", capacity: 40000 },
    });
    const twice = await refusal(
      api.post(FLEET, { path: ORG, body: { kind: "other", name: "X", asset_tag: "dh-01" } }),
    );
    const worked = await refusal(
      api.delete(UNIT, { path: { ...ORG, equipment_id: ids.equipment } }),
    );
    await api.delete(UNIT, { path: { ...ORG, equipment_id: heater.id } });

    expect(heater.capacity_unit).toBe("btu_per_hour");
    expect([twice.code, worked.code]).toEqual(["asset_tag_taken", "equipment_has_history"]);
  });

  test("placing takes a unit in service that isn't running elsewhere, not in the future", async () => {
    const api = await signedIn();
    await api.patch(UNIT, {
      path: { ...ORG, equipment_id: spare },
      body: { status: "maintenance" },
    });

    const busy = await refusal(place(api, ids.equipment));
    const repairing = await refusal(place(api, spare));
    await api.patch(UNIT, {
      path: { ...ORG, equipment_id: spare },
      body: { status: "in_service" },
    });
    const ahead = await refusal(place(api, spare, "2026-11-16T13:00:00Z"));
    const placed = await place(api, spare);

    expect([busy.code, repairing.code, ahead.code]).toEqual([
      "equipment_running",
      "equipment_unavailable",
      "time_in_future",
    ]);
    expect(placed).toMatchObject({ running: true, days: 1, room: { name: "Kitchen" } });
  });

  test("removing ends a placement's days; once only, and works on a closed claim", async () => {
    const api = await signedIn();
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    const path = { ...CLAIM, placement_id: ids.placement };
    const REMOVE = `${PLACEMENT}/remove` as const;

    const removed = await api.post(REMOVE, { path, body: { removed_at: "2026-11-16T10:00:00Z" } });
    const again = await refusal(api.post(REMOVE, { path, body: {} }));

    expect(removed).toMatchObject({ running: false, days: 2, removed_by: people.morgan });
    expect(again.code).toBe("already_removed");
  });

  test("corrections keep removal after placement, and put a unit back to running", async () => {
    const api = await signedIn();
    const path = { ...CLAIM, placement_id: ids.placement };
    await api.post(`${PLACEMENT}/remove`, { path, body: {} });

    const backwards = await refusal(
      api.patch(PLACEMENT, { path, body: { removed_at: "2026-11-13T10:00:00Z" } }),
    );
    const back = await api.patch(PLACEMENT, { path, body: { removed_at: null } });

    expect(backwards.code).toBe("removed_before_placed");
    expect(back.running).toBe(true);
  });

  test("equipment-days add up by kind", async () => {
    const api = await signedIn();

    expect(await api.get(DAYS, { path: CLAIM })).toEqual([
      { kind: "dehumidifier", placements: 1, running: 1, days: 2 },
      { kind: "air_mover", placements: 1, running: 1, days: 2 },
    ]);
  });

  test("a dehumidifier's exhaust is read, and its grain depression worked out", async () => {
    const api = await signedIn();
    const LOGS = "/v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs" as const;

    const visit = await api.post(LOGS, {
      path: CLAIM,
      body: {
        atmosphere: [
          { location: "room", room_id: ids.room, temperature_f: 86, relative_humidity: 50 },
          {
            location: "dehumidifier",
            placement_id: ids.placement,
            temperature_f: 68,
            relative_humidity: 50,
          },
        ],
      },
    });
    const notOne = await refusal(
      api.post(LOGS, {
        path: CLAIM,
        body: {
          atmosphere: [
            {
              location: "dehumidifier",
              placement_id: fixtureId("placement", 2),
              temperature_f: 70,
              relative_humidity: 40,
            },
          ],
        },
      }),
    );
    const log = await api.get("/v1/organizations/{organization_id}/claims/{claim_id}/drying-log", {
      path: CLAIM,
    });

    expect(visit.atmosphere[1]?.dehumidifier).toEqual({
      placement_id: ids.placement,
      asset_tag: "DH-01",
    });
    expect(notOne.code).toBe("unknown_dehumidifier");
    const exhaust = log.atmosphere.find((row) => row.dehumidifier !== null);
    // The visit with the exhaust reading: the room's 93.2 grains less the exhaust's 50.8.
    expect(exhaust?.values.find((v) => v !== null)?.grain_depression).toBe(42.4);
  });

  test("a unit still running in a room that's dry is flagged", async () => {
    const api = await signedIn();
    clock = Date.parse("2026-11-17T12:00:00Z");
    await api.post("/v1/organizations/{organization_id}/claims/{claim_id}/moisture-logs", {
      path: CLAIM,
      body: { readings: [{ point_id: ids.point, value: 11 }] },
    });

    const status = await api.get(
      "/v1/organizations/{organization_id}/claims/{claim_id}/drying-status",
      { path: CLAIM },
    );

    expect(status.alerts.map((a) => [a.kind, a.equipment?.asset_tag])).toEqual([
      ["equipment_in_dry_room", "DH-01"],
      ["equipment_in_dry_room", "AM-01"],
    ]);
  });
});

describe("properties", () => {
  const PROPERTY = "/v1/organizations/{organization_id}/properties/{property_id}" as const;
  const claims = (api: ApiClient) =>
    api.get("/v1/organizations/{organization_id}/claims", { path: ORG });

  test("a change shows on every claim at the property, the address rebuilt", async () => {
    const api = await signedIn();

    const changed = await api.patch(PROPERTY, {
      path: { ...ORG, property_id: ids.property },
      body: {
        address: {
          line1: "100 Congress Ave",
          line2: "Unit 4",
          city: "Austin",
          region: "TX",
          postal_code: "78701",
        },
        year_built: null,
        access_notes: "  Lockbox 1234 ",
      },
    });
    const listed = await claims(api);

    expect(changed.address.formatted).toBe("100 Congress Ave Unit 4, Austin, TX 78701");
    expect(changed).toMatchObject({ year_built: null, access_notes: "Lockbox 1234" });
    expect(listed.items.map((c) => c.property.address.formatted)).toEqual([
      "100 Congress Ave Unit 4, Austin, TX 78701",
      "100 Congress Ave Unit 4, Austin, TX 78701",
    ]);
  });

  test("another property's address is refused; changing it takes claims:write", async () => {
    const api = await signedIn();
    const other = backend.db.claims.find((c) => c.claim.number === "2026-00041");
    if (other) {
      other.claim = {
        ...other.claim,
        property: {
          ...other.claim.property,
          id: fixtureId("property", 2),
          address: {
            ...other.claim.property.address,
            line1: "5 Elm St",
            formatted: "5 Elm St, Austin, TX 78701",
          },
        },
      };
    }

    const taken = await refusal(
      api.patch(PROPERTY, {
        path: { ...ORG, property_id: ids.property },
        body: {
          address: { line1: "5 elm st", city: "Austin", region: "TX", postal_code: "78701" },
        },
      }),
    );
    const riley = await signedIn("riley@example.com");
    const notAllowed = await refusal(
      riley.patch(PROPERTY, {
        path: { ...ORG, property_id: ids.property },
        body: { year_built: 2000 },
      }),
    );

    expect([taken.code, notAllowed.status]).toEqual(["property_exists", 403]);
  });
});

describe("estimates", () => {
  const ESTIMATES = "/v1/organizations/{organization_id}/claims/{claim_id}/estimates" as const;
  const ESTIMATE = `${ESTIMATES}/{estimate_id}` as const;
  const LINES = `${ESTIMATE}/lines` as const;
  const LINE = `${LINES}/{line_id}` as const;
  const STATUS = `${ESTIMATE}/status` as const;
  const seeded = { ...CLAIM, estimate_id: ids.estimate };
  const move = (
    api: ApiClient,
    status: "draft" | "submitted" | "approved" | "rejected",
    estimate_id = ids.estimate,
  ) => api.post(STATUS, { path: { ...CLAIM, estimate_id }, body: { status } });

  test("the seeded draft is priced as the API prices it", async () => {
    const api = await signedIn();

    const estimate = await api.get(ESTIMATE, { path: seeded });

    // 3 × 85.00 + 6 × 28.00 = 423.00, untaxed; overhead and profit 10 % each.
    expect(estimate.totals).toEqual({
      subtotal: "423.00",
      taxable_subtotal: "0.00",
      tax: "0.00",
      overhead: "42.30",
      profit: "42.30",
      total: "507.60",
    });
    expect(estimate.rooms).toEqual([
      { room: { id: ids.room, name: "Kitchen" }, lines: 2, subtotal: "423.00" },
    ]);
    expect(estimate.price_list?.name).toBe("Lone Star 2026");
  });

  test("a new estimate is numbered on, with the organization's rates and default list", async () => {
    const api = await signedIn();

    const created = await api.post(ESTIMATES, { path: CLAIM, body: { title: "Rebuild" } });
    const listed = await api.get(ESTIMATES, { path: CLAIM });

    expect(created).toMatchObject({
      number: 2,
      status: "draft",
      tax_percent: "8.25",
      price_list: { id: ids.priceList },
      lines: [],
    });
    expect(listed.map((e) => e.title)).toEqual(["Mitigation", "Rebuild"]);
  });

  test("lines come from a price item or by hand, placed where asked, and move", async () => {
    const api = await signedIn();

    await api.post(LINES, {
      path: seeded,
      body: { price_item_id: fixtureId("priceItem", 4), quantity: "24", room_id: ids.room },
    });
    const byHand = await api.post(LINES, {
      path: seeded,
      body: {
        description: "Haul-off",
        unit: "EA",
        unit_price: "150.00",
        quantity: "1",
        position: 1,
      },
    });
    const third = byHand.lines[2];
    const moved = await api.patch(LINE, {
      path: { ...seeded, line_id: third?.id ?? "" },
      body: { position: 4, quantity: "2.5" },
    });

    expect(byHand.lines.map((l) => l.code ?? l.description)).toEqual([
      "Haul-off",
      "WTR-DEHU",
      "WTR-AIRM",
      "DRY-RMVF",
    ]);
    expect(byHand.lines[3]).toMatchObject({
      unit: "LF",
      unit_price: "3.10",
      total: "74.40",
      taxable: true,
    });
    expect(moved.lines.map((l) => [l.position, l.code ?? l.description])).toEqual([
      [1, "Haul-off"],
      [2, "WTR-DEHU"],
      [3, "DRY-RMVF"],
      [4, "WTR-AIRM"],
    ]);
    expect(moved.lines[3]?.total).toBe("70.00");
  });

  test("only drafts change; submitting needs a line; approving takes the right to approve", async () => {
    const api = await signedIn();
    const riley = await signedIn("riley@example.com");
    const empty = await api.post(ESTIMATES, { path: CLAIM, body: { title: "Empty" } });

    const noLines = await refusal(move(api, "submitted", empty.id));
    const submitted = await move(api, "submitted");
    const frozen = await refusal(
      api.post(LINES, {
        path: seeded,
        body: { description: "X", unit: "EA", unit_price: "1.00", quantity: "1" },
      }),
    );
    const skipped = await refusal(
      move(api, "draft", empty.id).then(() => move(api, "approved", empty.id)),
    );
    const notYours = await refusal(move(riley, "approved"));
    const approved = await move(api, "approved");

    expect(submitted.next_statuses).toEqual(["draft", "approved", "rejected"]);
    expect([noLines.code, frozen.code, skipped.code]).toEqual([
      "estimate_transition",
      "estimate_not_draft",
      "estimate_transition",
    ]);
    expect(notYours.status).toBe(403);
    expect(approved.status).toBe("approved");
  });

  test("price items are listed by code and searched by code or description", async () => {
    const api = await signedIn();
    const ITEMS = "/v1/organizations/{organization_id}/price-lists/{list_id}/items" as const;
    const path = { ...ORG, list_id: ids.priceList };

    const all = await api.get(ITEMS, { path });
    const found = await api.get(ITEMS, { path, query: { q: "drywall" } });
    const lists = await api.get("/v1/organizations/{organization_id}/price-lists", { path: ORG });

    expect(all.items[0]?.code).toBe("ANT-APPL");
    expect(found.items.map((i) => i.code)).toEqual(["DRY-INST", "DRY-RMVF"]);
    expect(lists[0]).toMatchObject({ is_default: true, item_count: 7 });
  });
});

const TIMELINE = "/v1/organizations/{organization_id}/claims/{claim_id}/timeline" as const;
const lastEvent = async (api: ApiClient) =>
  (await api.get(TIMELINE, { path: CLAIM })).items[0]?.summary;

/** Morgan, made a member of a second organization too: its id, for paths that mix the two. */
function alsoElsewhere(): string {
  const id = fixtureId("organization", 2);
  const morgan = backend.db.accounts.find((a) => a.email === "morgan@example.com");
  const membership = morgan?.user.memberships[0];
  if (!morgan || !membership) throw new Error("the seed has no membership for Morgan");
  morgan.user.memberships.push({
    ...membership,
    organization: { id, name: "Elsewhere", slug: "elsewhere" },
  });
  return id;
}

describe("documents", () => {
  const UPLOADS = "/v1/organizations/{organization_id}/claims/{claim_id}/document-uploads" as const;
  const DOCUMENTS = "/v1/organizations/{organization_id}/claims/{claim_id}/documents" as const;
  const DOCUMENT = `${DOCUMENTS}/{document_id}` as const;
  const pdf = (size = 900) => new Blob([new Uint8Array(size)], { type: "application/pdf" });

  async function attach(
    api: ApiClient,
    file: Blob,
    details: Partial<RequestBody<typeof UPLOADS, "post">> = {},
  ) {
    const started = await api.post(UPLOADS, {
      path: CLAIM,
      body: {
        filename: "Carrier letter.pdf",
        content_type: "application/pdf",
        size_bytes: file.size,
        ...details,
      },
    });
    await api.sendFile(started.upload, file);
    const complete = () =>
      api.post(`${UPLOADS}/{upload_id}/complete`, { path: { ...CLAIM, upload_id: started.id } });
    return { document: await complete(), complete };
  }

  test("an upload becomes a document titled from its name, its file served", async () => {
    const api = await signedIn("riley@example.com");

    const { document, complete } = await attach(api, pdf(), { category: "correspondence" });
    const again = await complete();
    const file = await fetch(document.view_url ?? "");

    expect(document).toMatchObject({
      title: "Carrier letter",
      category: "correspondence",
      uploaded_by: people.riley,
      size_bytes: 900,
    });
    expect(again.id).toBe(document.id);
    expect((await file.blob()).size).toBe(900);
    expect(await lastEvent(api)).toBe("Attached correspondence “Carrier letter”");
  });

  test("lists newest first, filtered by any of the categories given", async () => {
    const api = await signedIn();
    const { document } = await attach(api, pdf(), { category: "invoice", title: "Invoice 7" });

    const all = await api.get(DOCUMENTS, { path: CLAIM });
    const some = await api.get(DOCUMENTS, {
      path: CLAIM,
      query: { category: ["authorization", "policy"] },
    });

    expect(all.items.map((d) => d.id)).toEqual([document.id, ids.document]);
    expect(some.items.map((d) => d.title)).toEqual(["Signed work authorization"]);
  });

  test("what a browser can't show is only downloaded; too large or a closed claim is refused", async () => {
    const api = await signedIn();
    const word = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const { document } = await attach(api, new Blob([new Uint8Array(40)], { type: word }), {
      filename: "Scope.docx",
      content_type: word,
    });
    const big = await refusal(
      api.post(UPLOADS, {
        path: CLAIM,
        body: { filename: "a.pdf", content_type: "application/pdf", size_bytes: 51 * 1024 * 1024 },
      }),
    );
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    const closed = await refusal(attach(api, pdf()));

    expect(document.view_url).toBeNull();
    expect(document.download_url).toMatch(/download=1$/);
    expect([big.code, closed.code]).toEqual(["document_too_large", "claim_locked"]);
  });

  test("completing answers 201 the first time, 200 for a repeat", async () => {
    const { api, tokens } = client();
    await api.login({ email: "morgan@example.com", password: MOCK_PASSWORD });
    const started = await api.post(UPLOADS, {
      path: CLAIM,
      body: { filename: "a.pdf", content_type: "application/pdf", size_bytes: 9 },
    });
    await api.sendFile(started.upload, pdf(9));
    const complete = async () =>
      (
        await fetch(
          `https://api.test/v1/organizations/${ids.organization}/claims/${ids.claim}/document-uploads/${started.id}/complete`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${(await tokens.get())?.accessToken ?? ""}` },
          },
        )
      ).status;

    expect([await complete(), await complete()]).toEqual([201, 200]);
  });

  test("is found only through a claim of the organization in the path", async () => {
    const api = await signedIn();
    const elsewhere = { organization_id: alsoElsewhere(), claim_id: ids.claim };

    const document = await refusal(
      api.get(DOCUMENT, { path: { ...elsewhere, document_id: ids.document } }),
    );

    expect(document.status).toBe(404);
  });

  test("a change to both fields names the other; neither can be null", async () => {
    const api = await signedIn();
    const path = { ...CLAIM, document_id: ids.document };

    await api.patch(DOCUMENT, { path, body: { title: "WA-1042", category: "policy" } });
    const cleared = await refusal(api.patch(DOCUMENT, { path, body: { title: null } }));

    expect(await lastEvent(api)).toBe(
      "Renamed document “Signed work authorization” to “WA-1042”: category",
    );
    expect(cleared.status).toBe(422);
  });

  test("is retitled, recategorized and deleted, each on the timeline", async () => {
    const api = await signedIn();
    const path = { ...CLAIM, document_id: ids.document };

    const renamed = await api.patch(DOCUMENT, { path, body: { title: "WA-1042" } });
    const renaming = await lastEvent(api);
    await api.patch(DOCUMENT, { path, body: { category: "policy" } });
    const recategorizing = await lastEvent(api);
    await api.delete(DOCUMENT, { path });
    const gone = await refusal(api.get(DOCUMENT, { path }));

    expect(renamed.title).toBe("WA-1042");
    expect(renaming).toBe("Renamed document “Signed work authorization” to “WA-1042”");
    expect(recategorizing).toBe("Recategorized document “WA-1042” as policy");
    expect(await lastEvent(api)).toBe("Deleted document “WA-1042”");
    expect(gone.status).toBe(404);
  });

  test("a title from a file's name drops its extension, and only that", () => {
    expect(defaultTitle("WA-1042 signed.pdf")).toBe("WA-1042 signed");
    expect(defaultTitle("C:\\scans\\estimate.v2.pdf")).toBe("estimate.v2");
    expect(defaultTitle(".pdf")).toBe(".pdf");
  });
});

describe("reports", () => {
  const REPORTS = "/v1/organizations/{organization_id}/claims/{claim_id}/reports" as const;
  const REPORT = `${REPORTS}/{job_id}` as const;
  const SHARES = `${REPORT}/shares` as const;

  /** The answer itself, headers and all, as a signed-in browser would get it. */
  async function raw(
    tokens: ReturnType<typeof client>["tokens"],
    path: string,
    init?: RequestInit,
  ) {
    return fetch(`https://api.test${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${(await tokens.get())?.accessToken ?? ""}`,
        "Content-Type": "application/json",
      },
    });
  }

  test("a request is queued, polled, and made a moment later as a PDF", async () => {
    const { api, tokens } = client();
    await api.login({ email: "morgan@example.com", password: MOCK_PASSWORD });
    const base = `/v1/organizations/${ids.organization}/claims/${ids.claim}/reports`;

    const asked = await raw(tokens, base, {
      method: "POST",
      body: JSON.stringify({ kind: "photo_report" }),
    });
    const queued = (await asked.json()) as { id: string; status: string };
    const polled = await raw(tokens, `${base}/${queued.id}`);
    clock += REPORT_MS;
    const ready = await api.get(REPORT, { path: { ...CLAIM, job_id: queued.id } });
    const listed = await api.get(REPORTS, { path: CLAIM });
    const file = await (await fetch(ready.download_url ?? "")).text();

    expect(asked.status).toBe(202);
    expect(asked.headers.get("Location")).toBe(`${base}/${queued.id}`);
    expect(asked.headers.get("Retry-After")).toBe("2");
    expect(queued.status).toBe("queued");
    expect(polled.headers.get("Retry-After")).toBe("2");
    expect(ready).toMatchObject({ status: "ready", requested_by: people.morgan });
    expect(ready.size_bytes).toBe(file.length);
    expect(file).toMatch(/^%PDF-1\.4/);
    expect(file).toContain("(Photo Report 2026-00042)");
    expect(file).toContain("(1 photo)");
    expect(listed.map((r) => r.id)).toEqual([queued.id, ids.report]);
    expect(await lastEvent(api)).toBe("Generated the photo report");
  });

  test("needs reports:generate; a closed claim can still have one; deleting takes its links", async () => {
    const api = await signedIn();
    const riley = await signedIn("riley@example.com");
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";

    await api.post(REPORTS, { path: CLAIM, body: { kind: "drying_report" } });
    const denied = await refusal(
      riley.post(REPORTS, { path: CLAIM, body: { kind: "drying_report" } }),
    );
    const path = { ...CLAIM, job_id: ids.report };
    await api.post(SHARES, { path, body: {} });
    await api.delete(REPORT, { path });

    expect(denied.status).toBe(403);
    expect(backend.db.shares).toEqual([]);
    expect((await api.get(REPORTS, { path: CLAIM })).map((r) => r.kind)).toEqual(["drying_report"]);
    expect(await lastEvent(api)).toBe("Deleted a photo report");
  });

  test("a link is made for a ready report only, shown once, and counts its opens", async () => {
    const api = await signedIn();
    const queued = await api.post(REPORTS, { path: CLAIM, body: { kind: "photo_report" } });
    const path = { ...CLAIM, job_id: ids.report };

    const early = await refusal(
      api.post(SHARES, { path: { ...CLAIM, job_id: queued.id }, body: {} }),
    );
    const made = await api.post(SHARES, {
      path,
      body: { label: "For Lone Star Mutual", expires_in_days: 3 },
    });
    const opened = await fetch(made.url, { redirect: "manual" });
    const pdf = await (await fetch(opened.headers.get("Location") ?? "")).text();
    const [listed] = await api.get(SHARES, { path });

    expect(early.code).toBe("report_not_ready");
    expect(made.url).toMatch(/^https:\/\/api\.test\/v1\/shared-reports\/[0-9a-f]{64}$/);
    expect(made.expires_at).toBe("2026-11-19T12:00:00.000Z");
    expect(opened.status).toBe(302);
    expect(pdf).toMatch(/^%PDF/);
    expect(listed).toMatchObject({ active: true, open_count: 1, label: "For Lone Star Mutual" });
    expect(listed).not.toHaveProperty("url");
    expect(await lastEvent(api)).toBe("Shared a report by link for For Lone Star Mutual");
  });

  test("are found only through a claim of the organization in the path", async () => {
    const api = await signedIn();
    const elsewhere = { organization_id: alsoElsewhere(), claim_id: ids.claim };
    const path = { ...elsewhere, job_id: ids.report };

    const refused = await Promise.all([
      refusal(api.get(REPORT, { path })),
      refusal(api.get(SHARES, { path })),
      refusal(api.post(SHARES, { path, body: {} })),
      refusal(api.post(`${SHARES}/{share_id}/revoke`, { path: { ...path, share_id: ids.share } })),
      refusal(api.delete(REPORT, { path })),
    ]);

    expect(refused.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
    expect(backend.db.reports).toHaveLength(1);
  });

  test("a revoked or expired link stops working", async () => {
    const api = await signedIn();
    const path = { ...CLAIM, job_id: ids.report };
    const revoked = await api.post(SHARES, { path, body: { label: "Adjuster" } });
    const expiring = await api.post(SHARES, { path, body: { expires_in_days: 1 } });

    const stopped = await api.post(`${SHARES}/{share_id}/revoke`, {
      path: { ...path, share_id: revoked.id },
    });
    const revokedOpen = await fetch(revoked.url, { redirect: "manual" });
    clock += 25 * 3_600_000;
    const expiredOpen = await fetch(expiring.url, { redirect: "manual" });
    const shares = await api.get(SHARES, { path });

    expect(stopped.active).toBe(false);
    expect(await lastEvent(api)).toBe("Revoked a report link for Adjuster");
    expect([revokedOpen.status, expiredOpen.status]).toEqual([404, 404]);
    expect(((await expiredOpen.json()) as { code: string }).code).toBe("share_not_found");
    expect(shares.map((share) => share.active)).toEqual([false, false]);
  });
});

describe("reading one item of a claim", () => {
  const BASE = "/v1/organizations/{organization_id}/claims/{claim_id}" as const;

  test("goes through a claim of the organization in the path, as the API's reads do", async () => {
    const api = await signedIn();
    const here = CLAIM;
    const elsewhere = { organization_id: alsoElsewhere(), claim_id: ids.claim };
    const reads = (path: typeof here) => [
      api.get(`${BASE}/rooms/{room_id}`, { path: { ...path, room_id: ids.room } }),
      api.get(`${BASE}/damage-items/{damage_item_id}`, {
        path: { ...path, damage_item_id: ids.damage },
      }),
      api.get(`${BASE}/photos/{photo_id}`, { path: { ...path, photo_id: ids.photo } }),
      api.get(`${BASE}/moisture-points/{point_id}`, { path: { ...path, point_id: ids.point } }),
      api.get(`${BASE}/moisture-logs/{log_id}`, { path: { ...path, log_id: ids.log } }),
      api.get(`${BASE}/estimates/{estimate_id}`, {
        path: { ...path, estimate_id: ids.estimate },
      }),
    ];

    const found = await Promise.all(reads(here));
    const refused = await Promise.all(reads(elsewhere).map(refusal));

    expect(found.map((item) => item.id)).toEqual([
      ids.room,
      ids.damage,
      ids.photo,
      ids.point,
      ids.log,
      ids.estimate,
    ]);
    expect(refused.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404]);
  });

  test("completing a photo upload is field work on an open claim", async () => {
    const api = await signedIn();
    const UPLOADS = `${BASE}/photo-uploads` as const;
    const started = await api.post(UPLOADS, {
      path: CLAIM,
      body: { filename: "a.jpg", content_type: "image/jpeg", size_bytes: 4 },
    });
    await api.sendFile(started.upload, new Blob([new Uint8Array(4)], { type: "image/jpeg" }));
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";

    const closed = await refusal(
      api.post(`${UPLOADS}/{upload_id}/complete`, { path: { ...CLAIM, upload_id: started.id } }),
    );

    expect(closed.code).toBe("claim_locked");
  });
});

describe("organization settings", () => {
  const ORGANIZATION = "/v1/organizations/{organization_id}" as const;

  test("are changed field by field; a new name shows in everyone's /v1/me", async () => {
    const api = await signedIn();
    const riley = await signedIn("riley@example.com");

    const changed = await api.patch(ORGANIZATION, {
      path: ORG,
      body: {
        name: "  Lone Star Restoration & Dry-Out ",
        default_tax_percent: "8.250",
        timezone: null,
      },
    });
    const me = await riley.get("/v1/me");

    expect(changed).toMatchObject({
      name: "Lone Star Restoration & Dry-Out",
      default_tax_percent: "8.25",
      default_overhead_percent: "10",
      timezone: "America/Chicago",
    });
    expect(me.memberships[0]?.organization.name).toBe("Lone Star Restoration & Dry-Out");
  });

  test("refuse an unknown time zone, a rate over 100, a blank name, and a technician", async () => {
    const api = await signedIn();
    const riley = await signedIn("riley@example.com");
    const change = (body: RequestBody<typeof ORGANIZATION, "patch">, as = api) =>
      refusal(as.patch(ORGANIZATION, { path: ORG, body }));

    const zone = await change({ timezone: "Mars/Olympus_Mons" });
    const rate = await change({ default_profit_percent: "120" });
    const blank = await change({ name: "   " });
    const technician = await change({ name: "Riley's" }, riley);

    expect([zone.status, rate.status, blank.status]).toEqual([422, 422, 422]);
    expect(technician.status).toBe(403);
    expect(backend.db.organizations[0]?.name).toBe("Lone Star Restoration");
  });

  test("percents are written back as the API writes them", () => {
    expect([
      percentText("8.250"),
      percentText("10.000"),
      percentText("0"),
      percentText("7.125"),
    ]).toEqual(["8.25", "10", "0", "7.125"]);
  });
});

describe("invitations", () => {
  const INVITATIONS = "/v1/organizations/{organization_id}/invitations" as const;

  test("are listed newest first, and re-inviting re-issues the pending one", async () => {
    const api = await signedIn();

    const made = await api.post(INVITATIONS, {
      path: ORG,
      body: { email: "Avery@Example.com", role: "adjuster" },
    });
    const again = await api.post(INVITATIONS, {
      path: ORG,
      body: { email: "sam@example.com", role: "viewer" },
    });
    const pending = await api.get(INVITATIONS, { path: ORG });

    expect(made).toMatchObject({ email: "avery@example.com", role: "adjuster" });
    expect(made.expires_at).toBe("2026-11-23T12:00:00.000Z");
    expect(again.id).toBe(fixtureId("invitation"));
    expect(pending.map((i) => [i.email, i.role])).toEqual([
      ["avery@example.com", "adjuster"],
      ["sam@example.com", "viewer"],
    ]);
  });

  test("never hand out more than the inviter holds, nor invite a member", async () => {
    const api = await signedIn();
    const morgan = backend.db.accounts.find((a) => a.email === "morgan@example.com");
    const membership = morgan?.user.memberships[0];
    if (membership) {
      membership.role = "admin";
      membership.permissions = rolePermissions.admin;
    }

    const owner = await refusal(
      api.post(INVITATIONS, { path: ORG, body: { email: "new@example.com", role: "owner" } }),
    );
    const member = await refusal(
      api.post(INVITATIONS, {
        path: ORG,
        body: { email: "riley@example.com", role: "technician" },
      }),
    );

    expect(owner.status).toBe(403);
    expect(member.code).toBe("already_member");
  });

  test("are revoked, once; and need members:manage", async () => {
    const api = await signedIn();
    const riley = await signedIn("riley@example.com");
    const path = { ...ORG, invitation_id: fixtureId("invitation") };

    await api.delete(`${INVITATIONS}/{invitation_id}`, { path });
    const again = await refusal(api.delete(`${INVITATIONS}/{invitation_id}`, { path }));
    const technician = await refusal(riley.get(INVITATIONS, { path: ORG }));

    expect(await api.get(INVITATIONS, { path: ORG })).toEqual([]);
    expect(again.status).toBe(404);
    expect(technician.status).toBe(403);
  });
});
