/**
 * An in-memory ClaimForge API for frontend development and tests.
 *
 *     const backend = createMockBackend({ baseUrl: "https://api.test" });
 *     const server = setupServer(...backend.handlers);   // or setupWorker in a browser
 *
 * It covers what the web app's first screens need: sessions, `/v1/me`, organizations,
 * claims (lists, filters, pages, create, edit, the status workflow, assignments, contacts,
 * history, timeline), the address book, the layout and damage,
 * tasks, notes, and the layout to read. It behaves like the API where tests can tell:
 * the same status codes and error codes, refresh tokens that rotate with reuse detection,
 * the workflow the contract publishes (`workflows`), permissions by role, locked claims.
 * Every handler is a typed `mockApi` handler, so its answers are checked against the
 * contract too.
 *
 * `db` is plain data to seed or inspect; `reset()` puts the seed back. Sign in as
 * `morgan@example.com` (an owner) or `riley@example.com` (a technician), password
 * `MOCK_PASSWORD`.
 */
import type { HttpHandler } from "msw";

import * as fx from "../fixtures";
import type { Schema } from "../index";
import { workflows } from "../zod.gen";
import { mockApi, problem } from "./handlers";

type Claim = Schema<"ClaimRead">;
type Person = Schema<"ClaimActor">;
type Permission = Schema<"Permission">;
type Role = Schema<"Role">;

export const MOCK_PASSWORD = "correct horse battery staple";

export interface MockAccount {
  email: string;
  password: string;
  user: Schema<"MeResponse">;
}

/** Everything the mock knows. Plain data: seed it, change it, read it in assertions. */
export interface MockDb {
  accounts: MockAccount[];
  organizations: Schema<"OrganizationRead">[];
  claims: { organizationId: string; claim: Claim }[];
  statusChanges: { claimId: string; change: Schema<"ClaimStatusChangeRead"> }[];
  timeline: { claimId: string; entry: Schema<"TimelineEntry"> }[];
  structures: { claimId: string; structure: Schema<"StructureRead"> }[];
  /** Damage recorded in the claims' rooms; it goes with its room. */
  damage: { claimId: string; item: Schema<"DamageItemRead"> }[];
  tasks: Schema<"TaskRead">[];
  notes: Schema<"NoteRead">[];
  /** The address book; a deleted contact stays on the claims it's linked to. */
  contacts: { organizationId: string; contact: Contact; deleted: boolean }[];
}

function account(person: Person, email: string, role: Role): MockAccount {
  const org = fx.organization();
  return {
    email,
    password: MOCK_PASSWORD,
    user: {
      id: person.id,
      email,
      full_name: person.full_name,
      memberships: [
        {
          organization: { id: org.id, name: org.name, slug: org.slug },
          role,
          permissions: fx.rolePermissions[role],
        },
      ],
    },
  };
}

/** Two people, one organization, two claims (one with a task, a note and a layout). */
export function seedDb(): MockDb {
  const older = fx.claim({
    id: fx.fixtureId("claim", 2),
    number: "2026-00041",
    status: "inspected",
    loss_type: "fire",
    description: "Kitchen fire, smoke through the first floor",
    created_at: "2026-11-02T15:00:00Z",
    updated_at: "2026-11-03T15:00:00Z",
  });
  return {
    accounts: [
      account(fx.people.morgan, "morgan@example.com", "owner"),
      account(fx.people.riley, "riley@example.com", "technician"),
    ],
    organizations: [fx.organization()],
    claims: [
      { organizationId: fx.ids.organization, claim: older },
      // Jordan, the policyholder, is on this one; Casey is in the address book only.
      { organizationId: fx.ids.organization, claim: fx.claim({ contacts: [fx.claimContact()] }) },
    ],
    statusChanges: [
      {
        claimId: older.id,
        change: fx.statusChange({ changed_at: "2026-11-03T15:00:00Z" }),
      },
    ],
    timeline: [],
    structures: [{ claimId: fx.ids.claim, structure: fx.structure() }],
    damage: [{ claimId: fx.ids.claim, item: fx.damageItem() }],
    tasks: [fx.task()],
    notes: [fx.note()],
    contacts: [
      { organizationId: fx.ids.organization, contact: fx.contact(), deleted: false },
      { organizationId: fx.ids.organization, contact: fx.agentContact(), deleted: false },
    ],
  };
}

export interface MockBackendOptions {
  /** The API's origin, e.g. "https://api.test"; any origin when left out. */
  baseUrl?: string;
  /** The data to start from (and to go back to on `reset()`); `seedDb()` by default. */
  seed?: () => MockDb;
  /** The clock, in epoch milliseconds: access tokens expire by it. */
  now?: () => number;
}

export interface MockBackend {
  handlers: HttpHandler[];
  db: MockDb;
  /** Forget every change and session; back to the seed. */
  reset: () => void;
}

const ACCESS_TTL_S = 900;
const REFRESH_TTL_MS = 30 * 86_400_000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const FINAL: Schema<"ClaimStatus">[] = ["closed", "cancelled"];
/** Causes whose damage has a water category and class (IICRC S500), as the API has them. */
const WATER_CAUSES: Schema<"LossType">[] = ["water", "flood", "sewage", "storm"];
/** Causes whose water is always Category 3. */
const BLACK_WATER_CAUSES: Schema<"LossType">[] = ["flood", "sewage"];

/** Two decimals, as the API rounds measures. */
const cents = (n: number) => Math.round(n * 100) / 100;

/** A room with its floor area, wall area (gross) and volume worked out from its dimensions. */
function measured(room: Schema<"RoomRead">): Schema<"RoomRead"> {
  const { length_ft: l, width_ft: w, height_ft: h } = room;
  return {
    ...room,
    floor_area_sqft: l !== null && w !== null ? cents(l * w) : null,
    wall_area_sqft: l !== null && w !== null && h !== null ? cents(2 * (l + w) * h) : null,
    volume_cuft: l !== null && w !== null && h !== null ? cents(l * w * h) : null,
  };
}

/**
 * The water category to keep for damage with this cause, or the API's refusal: category
 * and class only for water causes (`not_water_damage`); flood and sewage always 3.
 */
function waterCategory(
  cause: Schema<"LossType">,
  category: number | null,
  waterClass: number | null,
): number | null | Response {
  if (!WATER_CAUSES.includes(cause)) {
    return category === null && waterClass === null
      ? null
      : problem(422, "not_water_damage", {
          detail: `Water category and class don't apply to ${cause} damage; clear them first`,
          cause,
        });
  }
  if (BLACK_WATER_CAUSES.includes(cause)) {
    return category === null || category === 3
      ? 3
      : problem(422, "black_water_category", {
          detail: `${cause[0]?.toUpperCase() ?? ""}${cause.slice(1)} water is always Category 3`,
          cause,
        });
  }
  return category;
}

/** A search needs this many digits before it looks at phone numbers, as the API's does. */
const MIN_PHONE_DIGITS = 3;

type Contact = Schema<"ContactRead">;

/**
 * A phone number in the API's canonical form, for the North American numbers the mock
 * deals in: "(512) 555-0142" is "+15125550142". Anything else is kept as typed.
 */
function canonicalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw.trim();
}

/** The preferred way to reach someone needs the details for it (`contact_method_unavailable`). */
function methodProblem(contact: Contact): Response | null {
  const method = contact.preferred_contact_method;
  const needs = method === "email" ? "email" : method ? "phone" : null;
  if (needs && !contact[needs]) {
    return problem(422, "contact_method_unavailable", {
      detail: `Add ${needs === "email" ? "an email address" : "a phone number"} before preferring contact by ${String(method)}`,
      preferred_contact_method: method,
    });
  }
  return null;
}
/** When the seeded members joined: the mock keeps no join dates of its own. */
const MEMBER_SINCE = "2026-11-01T12:00:00Z";
const MENTION = /<@([0-9a-f-]{36})>/g;
/** What each assignment role needs the member to be allowed, as the API checks it. */
const ASSIGNMENT_NEEDS: Record<Schema<"AssignmentRole">, Permission> = {
  adjuster: "claims:write",
  contractor: "field_data:write",
  field_technician: "field_data:write",
};

export function createMockBackend(options: MockBackendOptions = {}): MockBackend {
  const seed = options.seed ?? seedDb;
  const now = options.now ?? (() => Date.now());
  const api = mockApi(options.baseUrl);

  const backend: MockBackend = { handlers: [], db: seed(), reset };
  let sessions = newSessions();
  let sequence = 0;

  function reset(): void {
    backend.db = seed();
    sessions = newSessions();
    sequence = 0;
  }

  const db = () => backend.db;
  const iso = () => new Date(now()).toISOString();
  /** A new id that sorts after the seed's and every earlier one, like a UUIDv7. */
  const newId = () => {
    sequence += 1;
    return `0198a2c4-7b1e-7cc0-8000-ff${sequence.toString(16).padStart(10, "0")}`;
  };

  // ─── Sessions ──────────────────────────────────────────────────────────────

  function newSessions() {
    return {
      issued: 0,
      access: new Map<string, { userId: string; family: string; expiresAt: number }>(),
      refresh: new Map<string, { userId: string; family: string; used: boolean }>(),
      revoked: new Set<string>(),
    };
  }

  function issue(userId: string, family: string): Schema<"TokenResponse"> {
    sessions.issued += 1;
    const n = String(sessions.issued);
    const access_token = `mock-access-${n}`;
    const refresh_token = `mock-refresh-${n}`;
    sessions.access.set(access_token, {
      userId,
      family,
      expiresAt: now() + ACCESS_TTL_S * 1000,
    });
    sessions.refresh.set(refresh_token, { userId, family, used: false });
    return {
      access_token,
      token_type: "bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token,
      refresh_expires_at: new Date(now() + REFRESH_TTL_MS).toISOString(),
    };
  }

  /** The signed-in account, or the 401 the API would send. */
  function signedIn(request: Request): MockAccount | Response {
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    const session = token === undefined ? undefined : sessions.access.get(token);
    const found =
      session && session.expiresAt > now() && !sessions.revoked.has(session.family)
        ? db().accounts.find((a) => a.user.id === session.userId)
        : undefined;
    return found ?? problem(401, "authentication_required", { title: "Authentication required" });
  }

  /** The account's membership in `organizationId`, or the 404 an outsider gets. */
  function member(request: Request, organizationId: string) {
    const who = signedIn(request);
    if (who instanceof Response) {
      return who;
    }
    const membership = who.user.memberships.find((m) => m.organization.id === organizationId);
    if (!membership) {
      return problem(404, "not_found", { title: "Not found" });
    }
    const person: Person = { id: who.user.id, full_name: who.user.full_name };
    return { who, person, membership };
  }

  function allowed(
    membership: { permissions: Permission[] },
    permission: Permission,
  ): Response | null {
    return membership.permissions.includes(permission)
      ? null
      : problem(403, "permission_denied", {
          title: "Permission denied",
          required_permission: permission,
        });
  }

  // ─── Claims ────────────────────────────────────────────────────────────────

  function findClaim(organizationId: string, claimId: string) {
    return db().claims.find((c) => c.organizationId === organizationId && c.claim.id === claimId);
  }

  function claimOr404(organizationId: string, claimId: string): Claim | Response {
    return findClaim(organizationId, claimId)?.claim ?? problem(404, "not_found");
  }

  /** Closed and cancelled claims are read-only until reopened or reinstated. */
  function locked(claim: Claim): Response | null {
    return FINAL.includes(claim.status)
      ? problem(409, "claim_locked", { detail: `The claim is ${claim.status}` })
      : null;
  }

  /** A claim's structures, each with its rooms, in the order they were added. */
  function layoutOf(claimId: string): Schema<"StructureRead">[] {
    return db()
      .structures.filter((s) => s.claimId === claimId)
      .map((s) => s.structure);
  }

  /**
   * Field work on a claim: the member, allowed `field_data:write`, on a claim that isn't
   * locked; or the API's refusal.
   */
  function fieldWork(request: Request, organizationId: string, claimId: string) {
    const seen = member(request, organizationId);
    if (seen instanceof Response) return seen;
    const claim = claimOr404(organizationId, claimId);
    if (claim instanceof Response) return claim;
    return allowed(seen.membership, "field_data:write") ?? locked(claim) ?? { seen, claim };
  }

  /** `name_taken` if one of `named` already has `name`, ignoring case. */
  function nameTaken(
    named: { name: string }[],
    name: string,
    what: "structure" | "room" = "structure",
  ): Response | null {
    return named.some((n) => n.name.toLowerCase() === name.toLowerCase())
      ? problem(409, "name_taken", {
          detail:
            what === "room"
              ? `This structure already has a room named '${name}'`
              : `This claim already has a structure named '${name}'`,
        })
      : null;
  }

  function liveContact(organizationId: string, contactId: string) {
    return db().contacts.find(
      (c) => c.organizationId === organizationId && c.contact.id === contactId && !c.deleted,
    );
  }

  /** `links` ready for `link`: if it's primary, nobody else is (one primary per claim). */
  function withPrimary(
    links: Schema<"ClaimContactRead">[],
    link: Schema<"ClaimContactRead">,
  ): Schema<"ClaimContactRead">[] {
    return link.is_primary ? links.map((c) => ({ ...c, is_primary: false })) : links;
  }

  function replaceClaim(claim: Claim): Claim {
    const record = db().claims.find((c) => c.claim.id === claim.id);
    if (record) {
      record.claim = claim;
    }
    return claim;
  }

  function record(
    claimId: string,
    person: Person,
    kind: Schema<"TimelineKind">,
    action: string,
    summary: string,
  ): void {
    db().timeline.push({
      claimId,
      entry: {
        id: newId(),
        at: iso(),
        kind,
        action,
        actor: person,
        subject: { type: "claim", id: claimId },
        summary,
        changes: {},
      },
    });
  }

  function summarize(claim: Claim): Schema<"ClaimSummary"> {
    const adjuster = claim.assignments.find((a) => a.role === "adjuster")?.user ?? null;
    const primary = claim.contacts.find((c) => c.is_primary) ?? null;
    return {
      ...fx.claimSummary(),
      id: claim.id,
      number: claim.number,
      status: claim.status,
      loss_type: claim.loss_type,
      loss_date: claim.loss_date,
      policy_number: claim.policy_number,
      carrier_name: claim.carrier_name,
      carrier_claim_number: claim.carrier_claim_number,
      property: claim.property,
      primary_contact: primary,
      adjuster,
      created_at: claim.created_at,
      updated_at: claim.updated_at,
    };
  }

  function matches(claim: Claim, query: URLSearchParams): boolean {
    const statuses = query.getAll("status");
    const lossTypes = query.getAll("loss_type");
    const text = query.get("q")?.trim().toLowerCase();
    const { address } = claim.property;
    const haystack = [
      claim.number,
      claim.carrier_name,
      claim.carrier_claim_number,
      claim.policy_number,
      address.line1,
      address.city,
      address.postal_code,
    ];
    return (
      (statuses.length === 0 || statuses.includes(claim.status)) &&
      (lossTypes.length === 0 || lossTypes.includes(claim.loss_type)) &&
      (!text || haystack.some((field) => field?.toLowerCase().includes(text)))
    );
  }

  /** The API's sort orders; claims without a loss date go last, or first for "-". */
  function sorted(claims: Claim[], sort: string | null): Claim[] {
    const field = (sort ?? "-created_at").replace(/^-/, "") as keyof Claim;
    const descending = (sort ?? "-created_at").startsWith("-");
    return [...claims].sort((a, b) => {
      const [x, y] = [a[field] as string | null, b[field] as string | null];
      if (x === y) return descending ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
      if (x === null) return descending ? -1 : 1;
      if (y === null) return descending ? 1 : -1;
      return descending ? y.localeCompare(x) : x.localeCompare(y);
    });
  }

  function nextNumber(organizationId: string): string {
    const year = new Date(now()).getUTCFullYear();
    const taken = db()
      .claims.filter((c) => c.organizationId === organizationId)
      .map((c) => c.claim.number)
      .filter((n) => n.startsWith(`${String(year)}-`))
      .map((n) => Number(n.slice(5)));
    return `${String(year)}-${String(Math.max(0, ...taken) + 1).padStart(5, "0")}`;
  }

  // ─── Lists ─────────────────────────────────────────────────────────────────

  /** A cursor page of `items` (already in order); cursors are offsets, opaque to clients. */
  function paginate<Item>(items: Item[], query: URLSearchParams) {
    const limit = Math.max(1, Math.min(Number(query.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT));
    const offset = Number(query.get("cursor") ?? 0);
    const end = offset + limit;
    return {
      items: items.slice(offset, end),
      next_cursor: end < items.length ? String(end) : null,
      has_more: end < items.length,
    };
  }

  const newestFirst = <Item extends { id: string }>(items: Item[]) =>
    [...items].sort((a, b) => b.id.localeCompare(a.id));

  // ─── Tasks and notes ───────────────────────────────────────────────────────

  function personById(id: string): Person | undefined {
    const found = db().accounts.find((a) => a.user.id === id);
    return found && { id: found.user.id, full_name: found.user.full_name };
  }

  /** Open first, then soonest due (undated last), as the API orders a claim's tasks. */
  const taskOrder = (a: Schema<"TaskRead">, b: Schema<"TaskRead">) =>
    Number(a.done) - Number(b.done) ||
    (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") ||
    a.id.localeCompare(b.id);

  /** The members `body` mentions, or the 422 naming one who isn't. */
  function mentions(body: string): Person[] | Response {
    const people: Person[] = [];
    for (const [, id] of body.matchAll(MENTION)) {
      const person = id === undefined ? undefined : personById(id);
      if (!person) {
        return problem(422, "unknown_mention", { detail: `${String(id)} isn't a member` });
      }
      if (!people.some((p) => p.id === person.id)) {
        people.push(person);
      }
    }
    return people;
  }

  function render(body: string, people: Person[]): string {
    return body.replace(MENTION, (token, id: string) => {
      const person = people.find((p) => p.id === id);
      return person ? `@${person.full_name}` : token;
    });
  }

  const ORG = "/v1/organizations/{organization_id}" as const;
  const CLAIMS = `${ORG}/claims` as const;
  const CLAIM = `${CLAIMS}/{claim_id}` as const;

  backend.handlers = [
    // ─── Auth ────────────────────────────────────────────────────────────────
    api.post("/v1/auth/login", ({ body }) => {
      const found = db().accounts.find(
        (a) => a.email.toLowerCase() === body.email.toLowerCase() && a.password === body.password,
      );
      return found
        ? issue(found.user.id, newId())
        : problem(401, "invalid_credentials", { title: "Invalid email or password" });
    }),
    api.post("/v1/auth/refresh", ({ body }) => {
      const token = sessions.refresh.get(body.refresh_token);
      if (!token || sessions.revoked.has(token.family)) {
        return problem(401, "invalid_refresh_token");
      }
      if (token.used) {
        // Someone presented a token that was already exchanged: end the whole session.
        sessions.revoked.add(token.family);
        return problem(401, "refresh_token_reused");
      }
      token.used = true;
      return issue(token.userId, token.family);
    }),
    api.post("/v1/auth/logout", ({ body }) => {
      const token = sessions.refresh.get(body.refresh_token);
      if (token) {
        sessions.revoked.add(token.family);
      }
      return undefined;
    }),
    api.get("/v1/me", ({ request }) => {
      const who = signedIn(request);
      return who instanceof Response ? who : who.user;
    }),

    // ─── Organizations ───────────────────────────────────────────────────────
    api.get("/v1/organizations", ({ request, query }) => {
      const who = signedIn(request);
      if (who instanceof Response) return who;
      const mine = new Set(who.user.memberships.map((m) => m.organization.id));
      return paginate(
        db().organizations.filter((org) => mine.has(org.id)),
        query,
      );
    }),
    api.get(ORG, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      return (
        db().organizations.find((org) => org.id === params.organization_id) ??
        problem(404, "not_found")
      );
    }),

    // ─── Claims ──────────────────────────────────────────────────────────────
    api.get(CLAIMS, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claims = db()
        .claims.filter((c) => c.organizationId === params.organization_id)
        .map((c) => c.claim)
        .filter((claim) => matches(claim, query));
      return paginate(sorted(claims, query.get("sort")).map(summarize), query);
    }),
    api.post(CLAIMS, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "claims:write");
      if (refused) return refused;
      if ((body.property_id == null) === (body.property == null)) {
        return problem(422, "validation_failed", {
          title: "Invalid request",
          detail: "1 field(s) failed validation",
          errors: [
            {
              loc: ["body"],
              message: "Value error, Give exactly one of property_id or property",
              type: "value_error",
            },
          ],
        });
      }
      let property: Schema<"PropertyRead">;
      const given = body.property;
      if (given == null) {
        const existing = db().claims.find((c) => c.claim.property.id === body.property_id);
        if (!existing) return problem(422, "unknown_property");
        property = existing.claim.property;
      } else {
        const { line1, line2 = null, city, region = null, postal_code = null } = given.address;
        property = {
          id: newId(),
          address: {
            line1,
            line2,
            city,
            region,
            postal_code,
            country: given.address.country ?? "US",
            formatted: `${[line1, line2].filter(Boolean).join(" ")}, ${city}${
              region ? `, ${[region, postal_code].filter(Boolean).join(" ")}` : ""
            }`,
          },
          property_type: given.property_type ?? "residential",
          year_built: given.year_built ?? null,
          latitude: given.latitude ?? null,
          longitude: given.longitude ?? null,
          access_notes: given.access_notes ?? null,
          created_at: iso(),
          updated_at: iso(),
        };
      }
      const claim: Claim = {
        ...fx.claim(),
        id: newId(),
        number: nextNumber(params.organization_id),
        loss_type: body.loss_type,
        loss_date: body.loss_date ?? null,
        description: body.description ?? null,
        policy_number: body.policy_number ?? null,
        carrier_name: body.carrier_name ?? null,
        carrier_claim_number: body.carrier_claim_number ?? null,
        property,
        contacts: [],
        assignments: [],
        created_by_id: seen.person.id,
        created_at: iso(),
        updated_at: iso(),
      };
      db().claims.push({ organizationId: params.organization_id, claim });
      record(claim.id, seen.person, "claim", "claim_created", `Opened claim ${claim.number}`);
      return claim;
    }),
    api.get(`${CLAIMS}/by-number/{number}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      return (
        db().claims.find(
          (c) => c.organizationId === params.organization_id && c.claim.number === params.number,
        )?.claim ?? problem(404, "not_found")
      );
    }),
    api.get(CLAIM, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      return claimOr404(params.organization_id, params.claim_id);
    }),
    api.patch(CLAIM, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "claims:write") ?? locked(claim);
      if (refused) return refused;
      record(claim.id, seen.person, "claim", "claim_updated", "Edited the claim's details");
      return replaceClaim({
        ...claim,
        ...body,
        loss_type: body.loss_type ?? claim.loss_type,
        updated_at: iso(),
      });
    }),
    api.post(`${CLAIM}/status`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const current = claim.status;
      if (body.expected_status != null && body.expected_status !== current) {
        return problem(409, "status_changed", {
          detail: `The claim is ${current} now, not ${body.expected_status}`,
          current_status: current,
        });
      }
      const allowedNext: readonly string[] = workflows.ClaimStatus.transitions[current];
      if (!allowedNext.includes(body.status)) {
        return problem(422, "invalid_status_transition", {
          detail: `A claim that is ${current} cannot become ${body.status}`,
          from_status: current,
          to_status: body.status,
          allowed: [...allowedNext],
        });
      }
      const refused = allowed(
        seen.membership,
        FINAL.includes(current) ? "claims:reopen" : "claims:write",
      );
      if (refused) return refused;
      const needsReason: readonly string[] = workflows.ClaimStatus.reasonRequired[current];
      if (needsReason.includes(body.status) && !body.reason) {
        return problem(422, "reason_required", {
          detail: `Say why the claim goes from ${current} to ${body.status}`,
        });
      }
      db().statusChanges.push({
        claimId: claim.id,
        change: {
          id: newId(),
          from_status: current,
          to_status: body.status,
          reason: body.reason ?? null,
          changed_by: seen.person,
          changed_at: iso(),
        },
      });
      record(
        claim.id,
        seen.person,
        "status",
        "status_changed",
        `Moved from ${current} to ${body.status}`,
      );
      return replaceClaim({
        ...claim,
        status: body.status,
        next_statuses: [...workflows.ClaimStatus.transitions[body.status]],
        updated_at: iso(),
      });
    }),
    api.post(`${CLAIM}/assignments`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "claims:write") ?? locked(claim);
      if (refused) return refused;
      const assignee = db().accounts.find((a) => a.user.id === body.user_id);
      const membership = assignee?.user.memberships.find(
        (m) => m.organization.id === params.organization_id,
      );
      if (!assignee || !membership) {
        return problem(422, "unknown_assignee", {
          detail: "Only members of this organization can be assigned",
        });
      }
      const needed = ASSIGNMENT_NEEDS[body.role];
      if (!membership.permissions.includes(needed)) {
        return problem(422, "assignee_lacks_permission", {
          detail: `A ${membership.role} can't be assigned as ${body.role}`,
          member_role: membership.role,
          assignee_needs: needed,
        });
      }
      const existing = claim.assignments.find((a) => a.user.id === body.user_id);
      if (existing) {
        return problem(409, "already_assigned", {
          detail: `Already assigned to this claim as ${existing.role}; unassign first to change roles`,
          current_role: existing.role,
        });
      }
      const assignment: Schema<"ClaimAssignmentRead"> = {
        user: { id: assignee.user.id, full_name: assignee.user.full_name },
        role: body.role,
        assigned_at: iso(),
        assigned_by_id: seen.person.id,
      };
      // One adjuster per claim: a new one replaces the last.
      const kept =
        body.role === "adjuster"
          ? claim.assignments.filter((a) => a.role !== "adjuster")
          : claim.assignments;
      replaceClaim({ ...claim, assignments: [...kept, assignment], updated_at: iso() });
      record(
        claim.id,
        seen.person,
        "team",
        "member_assigned",
        `Assigned ${assignment.user.full_name} as ${body.role.replace("_", " ")}`,
      );
      return assignment;
    }),
    api.delete(`${CLAIM}/assignments/{user_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "claims:write") ?? locked(claim);
      if (refused) return refused;
      const assignment = claim.assignments.find((a) => a.user.id === params.user_id);
      if (!assignment) {
        return problem(404, "not_found", { detail: "That member is not assigned to this claim" });
      }
      replaceClaim({
        ...claim,
        assignments: claim.assignments.filter((a) => a !== assignment),
        updated_at: iso(),
      });
      record(
        claim.id,
        seen.person,
        "team",
        "member_unassigned",
        `Took ${assignment.user.full_name} off the claim`,
      );
      return undefined;
    }),
    api.get(`${CLAIM}/status-history`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      return db()
        .statusChanges.filter((s) => s.claimId === claim.id)
        .map((s) => s.change);
    }),
    api.get(`${CLAIM}/timeline`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const kinds = query.getAll("kind");
      const entries = db()
        .timeline.filter((t) => t.claimId === claim.id)
        .map((t) => t.entry)
        .filter((entry) => kinds.length === 0 || kinds.includes(entry.kind));
      return paginate(newestFirst(entries), query);
    }),

    // ─── Layout ──────────────────────────────────────────────────────────────
    api.get(`${CLAIM}/structures`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      return db()
        .structures.filter((s) => s.claimId === claim.id)
        .map((s) => s.structure);
    }),
    api.get(`${CLAIM}/rooms/{room_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const room = db()
        .structures.filter((s) => s.claimId === params.claim_id)
        .flatMap((s) => s.structure.rooms)
        .find((r) => r.id === params.room_id);
      return room ?? problem(404, "not_found");
    }),
    api.post(`${CLAIM}/structures`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const name = body.name.trim();
      const taken = nameTaken(layoutOf(ready.claim.id), name);
      if (taken) return taken;
      const structure: Schema<"StructureRead"> = {
        id: newId(),
        name,
        rooms: [],
        created_at: iso(),
        updated_at: iso(),
      };
      db().structures.push({ claimId: ready.claim.id, structure });
      record(ready.claim.id, ready.seen.person, "layout", "structure_added", `Added ${name}`);
      return structure;
    }),
    api.patch(`${CLAIM}/structures/{structure_id}`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().structures.find(
        (s) => s.claimId === ready.claim.id && s.structure.id === params.structure_id,
      );
      if (!entry) return problem(404, "not_found");
      if (body.name != null) {
        const name = body.name.trim();
        const taken = nameTaken(
          layoutOf(ready.claim.id).filter((s) => s.id !== entry.structure.id),
          name,
        );
        if (taken) return taken;
        const before = entry.structure.name;
        entry.structure = { ...entry.structure, name, updated_at: iso() };
        record(
          ready.claim.id,
          ready.seen.person,
          "layout",
          "structure_renamed",
          `Renamed ${before} to ${name}`,
        );
      }
      return entry.structure;
    }),
    api.delete(`${CLAIM}/structures/{structure_id}`, ({ request, params }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().structures.find(
        (s) => s.claimId === ready.claim.id && s.structure.id === params.structure_id,
      );
      if (!entry) return problem(404, "not_found");
      const rooms = new Set(entry.structure.rooms.map((r) => r.id));
      backend.db.structures = db().structures.filter((s) => s !== entry);
      backend.db.damage = db().damage.filter((d) => !rooms.has(d.item.room_id));
      record(
        ready.claim.id,
        ready.seen.person,
        "layout",
        "structure_deleted",
        `Deleted ${entry.structure.name}`,
      );
      return undefined;
    }),
    api.post(`${CLAIM}/structures/{structure_id}/rooms`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().structures.find(
        (s) => s.claimId === ready.claim.id && s.structure.id === params.structure_id,
      );
      if (!entry) return problem(404, "not_found");
      const name = body.name.trim();
      const taken = nameTaken(entry.structure.rooms, name, "room");
      if (taken) return taken;
      const room = measured({
        id: newId(),
        structure_id: entry.structure.id,
        name,
        level: body.level ?? null,
        length_ft: body.length_ft ?? null,
        width_ft: body.width_ft ?? null,
        height_ft: body.height_ft ?? null,
        floor_area_sqft: null,
        wall_area_sqft: null,
        volume_cuft: null,
        created_at: iso(),
        updated_at: iso(),
      });
      entry.structure = { ...entry.structure, rooms: [...entry.structure.rooms, room] };
      record(
        ready.claim.id,
        ready.seen.person,
        "layout",
        "room_added",
        `Added the ${name} to ${entry.structure.name}`,
      );
      return room;
    }),
    api.patch(`${CLAIM}/rooms/{room_id}`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const home = db().structures.find(
        (s) =>
          s.claimId === ready.claim.id && s.structure.rooms.some((r) => r.id === params.room_id),
      );
      const current = home?.structure.rooms.find((r) => r.id === params.room_id);
      if (!home || !current) return problem(404, "not_found");
      const target = body.structure_id
        ? db().structures.find(
            (s) => s.claimId === ready.claim.id && s.structure.id === body.structure_id,
          )
        : home;
      if (!target) {
        return problem(422, "unknown_structure", {
          detail: "Rooms can only move to another structure of the same claim",
          structure_id: body.structure_id,
        });
      }
      const changed = { ...current, updated_at: iso(), structure_id: target.structure.id };
      if (body.name != null) changed.name = body.name.trim();
      for (const field of ["level", "length_ft", "width_ft", "height_ft"] as const) {
        if (field in body) Object.assign(changed, { [field]: body[field] ?? null });
      }
      const taken = nameTaken(
        target.structure.rooms.filter((r) => r.id !== current.id),
        changed.name,
        "room",
      );
      if (taken) return taken;
      const room = measured(changed);
      home.structure = {
        ...home.structure,
        rooms: home.structure.rooms.filter((r) => r.id !== room.id),
      };
      target.structure = {
        ...target.structure,
        rooms: [...target.structure.rooms, room].sort((a, b) => a.id.localeCompare(b.id)),
      };
      record(
        ready.claim.id,
        ready.seen.person,
        "layout",
        "room_updated",
        `Changed the ${room.name}`,
      );
      return room;
    }),
    api.delete(`${CLAIM}/rooms/{room_id}`, ({ request, params }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const home = db().structures.find(
        (s) =>
          s.claimId === ready.claim.id && s.structure.rooms.some((r) => r.id === params.room_id),
      );
      const room = home?.structure.rooms.find((r) => r.id === params.room_id);
      if (!home || !room) return problem(404, "not_found");
      home.structure = { ...home.structure, rooms: home.structure.rooms.filter((r) => r !== room) };
      backend.db.damage = db().damage.filter((d) => d.item.room_id !== room.id);
      record(
        ready.claim.id,
        ready.seen.person,
        "layout",
        "room_deleted",
        `Deleted the ${room.name}`,
      );
      return undefined;
    }),

    // ─── Damage ──────────────────────────────────────────────────────────────
    api.get(`${CLAIM}/damage-items`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const roomId = query.get("room_id");
      const cause = query.get("cause");
      // By room, in the order the rooms were added; within a room, as recorded.
      const order = layoutOf(claim.id).flatMap((s) => s.rooms.map((r) => r.id));
      return db()
        .damage.filter((d) => d.claimId === claim.id)
        .map((d) => d.item)
        .filter((item) => (!roomId || item.room_id === roomId) && (!cause || item.cause === cause))
        .sort(
          (a, b) => order.indexOf(a.room_id) - order.indexOf(b.room_id) || a.id.localeCompare(b.id),
        );
    }),
    api.get(`${CLAIM}/damage-items/{damage_item_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const found = db().damage.find(
        (d) => d.claimId === params.claim_id && d.item.id === params.damage_item_id,
      );
      return found?.item ?? problem(404, "not_found");
    }),
    api.post(`${CLAIM}/rooms/{room_id}/damage-items`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const room = layoutOf(ready.claim.id)
        .flatMap((s) => s.rooms)
        .find((r) => r.id === params.room_id);
      if (!room) return problem(404, "not_found");
      const cause = body.cause ?? ready.claim.loss_type;
      const category = waterCategory(cause, body.water_category ?? null, body.water_class ?? null);
      if (category instanceof Response) return category;
      const item: Schema<"DamageItemRead"> = {
        id: newId(),
        room_id: room.id,
        surface: body.surface,
        material: body.material.trim(),
        description: body.description ?? null,
        cause,
        water_category: category,
        water_class: body.water_class ?? null,
        created_by_id: ready.seen.person.id,
        created_at: iso(),
        updated_at: iso(),
      };
      db().damage.push({ claimId: ready.claim.id, item });
      record(
        ready.claim.id,
        ready.seen.person,
        "damage",
        "damage_recorded",
        `Recorded ${item.material.toLowerCase()} damage in the ${room.name}`,
      );
      return item;
    }),
    api.patch(`${CLAIM}/damage-items/{damage_item_id}`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().damage.find(
        (d) => d.claimId === ready.claim.id && d.item.id === params.damage_item_id,
      );
      if (!entry) return problem(404, "not_found");
      if (
        body.room_id &&
        !layoutOf(ready.claim.id).some((s) => s.rooms.some((r) => r.id === body.room_id))
      ) {
        return problem(422, "unknown_room", {
          detail: "Damage can only move to another room of the same claim",
          room_id: body.room_id,
        });
      }
      const changed = { ...entry.item, updated_at: iso() };
      if (body.room_id) changed.room_id = body.room_id;
      if (body.surface) changed.surface = body.surface;
      if (body.material) changed.material = body.material.trim();
      if (body.cause) changed.cause = body.cause;
      for (const field of ["description", "water_category", "water_class"] as const) {
        if (field in body) Object.assign(changed, { [field]: body[field] ?? null });
      }
      const category = waterCategory(changed.cause, changed.water_category, changed.water_class);
      if (category instanceof Response) return category;
      entry.item = { ...changed, water_category: category };
      record(
        ready.claim.id,
        ready.seen.person,
        "damage",
        "damage_updated",
        `Changed the ${entry.item.material.toLowerCase()} damage`,
      );
      return entry.item;
    }),
    api.delete(`${CLAIM}/damage-items/{damage_item_id}`, ({ request, params }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().damage.find(
        (d) => d.claimId === ready.claim.id && d.item.id === params.damage_item_id,
      );
      if (!entry) return problem(404, "not_found");
      backend.db.damage = db().damage.filter((d) => d !== entry);
      record(
        ready.claim.id,
        ready.seen.person,
        "damage",
        "damage_deleted",
        `Deleted the ${entry.item.material.toLowerCase()} damage`,
      );
      return undefined;
    }),

    // ─── Tasks ───────────────────────────────────────────────────────────────
    api.get(`${CLAIM}/tasks`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const status = query.get("status");
      return db()
        .tasks.filter((t) => t.claim.id === claim.id)
        .filter((t) => status === null || t.done === (status === "done"))
        .sort(taskOrder);
    }),
    api.post(`${CLAIM}/tasks`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "field_data:write") ?? locked(claim);
      if (refused) return refused;
      const assignee = body.assignee_id == null ? null : personById(body.assignee_id);
      if (assignee === undefined) return problem(422, "unknown_assignee");
      const task: Schema<"TaskRead"> = {
        id: newId(),
        claim: { id: claim.id, number: claim.number },
        title: body.title,
        description: body.description ?? null,
        due_on: body.due_on ?? null,
        done: false,
        completed_at: null,
        completed_by_id: null,
        assignee,
        created_by_id: seen.person.id,
        created_at: iso(),
        updated_at: iso(),
      };
      db().tasks.push(task);
      record(claim.id, seen.person, "tasks", "task_created", `Added the task "${task.title}"`);
      return task;
    }),
    api.patch(`${CLAIM}/tasks/{task_id}`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "field_data:write") ?? locked(claim);
      if (refused) return refused;
      const index = db().tasks.findIndex((t) => t.id === params.task_id && t.claim.id === claim.id);
      const task = db().tasks[index];
      if (!task) return problem(404, "not_found");
      const assignee =
        body.assignee_id === undefined
          ? task.assignee
          : body.assignee_id === null
            ? null
            : personById(body.assignee_id);
      if (assignee === undefined) return problem(422, "unknown_assignee");
      const done = body.done ?? task.done;
      const updated: Schema<"TaskRead"> = {
        ...task,
        title: body.title ?? task.title,
        description: body.description === undefined ? task.description : body.description,
        due_on: body.due_on === undefined ? task.due_on : body.due_on,
        assignee,
        done,
        // Completing a done task or reopening an open one changes nothing.
        completed_at: done === task.done ? task.completed_at : done ? iso() : null,
        completed_by_id: done === task.done ? task.completed_by_id : done ? seen.person.id : null,
        updated_at: iso(),
      };
      db().tasks[index] = updated;
      return updated;
    }),
    api.delete(`${CLAIM}/tasks/{task_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const task = db().tasks.find((t) => t.id === params.task_id && t.claim.id === claim.id);
      if (!task) return problem(404, "not_found");
      if (task.created_by_id !== seen.person.id && allowed(seen.membership, "claims:delete")) {
        return problem(403, "not_task_creator", { required_permission: "claims:delete" });
      }
      const refused = locked(claim);
      if (refused) return refused;
      backend.db.tasks = db().tasks.filter((t) => t.id !== task.id);
      return undefined;
    }),
    // ─── Contacts ────────────────────────────────────────────────────────────
    api.get(`${ORG}/contacts`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "contacts:read");
      if (refused) return refused;
      const kind = query.get("kind");
      const q = (query.get("q") ?? "").trim().toLowerCase();
      const digits = q.replace(/\D/g, "");
      const matches = (c: Contact) =>
        [c.full_name, c.company_name, c.email].some((text) => text?.toLowerCase().includes(q)) ||
        (digits.length >= MIN_PHONE_DIGITS && (c.phone ?? "").includes(digits));
      const found = db()
        .contacts.filter((c) => c.organizationId === params.organization_id && !c.deleted)
        .map((c) => c.contact)
        .filter((c) => (!kind || c.kind === kind) && (!q || matches(c)))
        .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id));
      return paginate(found, query);
    }),
    api.post(`${ORG}/contacts`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "contacts:write");
      if (refused) return refused;
      const contact: Contact = {
        id: newId(),
        kind: body.kind ?? "other",
        full_name: body.full_name.trim(),
        company_name: body.company_name ?? null,
        email: body.email ?? null,
        phone: body.phone ? canonicalPhone(body.phone) : null,
        preferred_contact_method: body.preferred_contact_method ?? null,
        notes: body.notes ?? null,
        created_at: iso(),
        updated_at: iso(),
      };
      const unavailable = methodProblem(contact);
      if (unavailable) return unavailable;
      db().contacts.push({ organizationId: params.organization_id, contact, deleted: false });
      return contact;
    }),
    api.get(`${ORG}/contacts/{contact_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "contacts:read");
      if (refused) return refused;
      return (
        liveContact(params.organization_id, params.contact_id)?.contact ?? problem(404, "not_found")
      );
    }),
    api.patch(`${ORG}/contacts/{contact_id}`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "contacts:write");
      if (refused) return refused;
      const record = liveContact(params.organization_id, params.contact_id);
      if (!record) return problem(404, "not_found");
      const changed: Contact = { ...record.contact, updated_at: iso() };
      // A JSON body has no undefined: what's there is set, `null` clearing it.
      for (const [field, value] of Object.entries(body)) {
        if (field === "full_name" || field === "kind") {
          if (value !== null) Object.assign(changed, { [field]: value });
        } else {
          Object.assign(changed, {
            [field]: field === "phone" && typeof value === "string" ? canonicalPhone(value) : value,
          });
        }
      }
      const unavailable = methodProblem(changed);
      if (unavailable) return unavailable;
      record.contact = changed;
      // Claims carry their contacts: they show the change too.
      for (const { claim } of db().claims) {
        claim.contacts = claim.contacts.map((link) =>
          link.contact.id === changed.id ? { ...link, contact: changed } : link,
        );
      }
      return changed;
    }),
    api.delete(`${ORG}/contacts/{contact_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "contacts:write");
      if (refused) return refused;
      const record = liveContact(params.organization_id, params.contact_id);
      if (!record) return problem(404, "not_found");
      record.deleted = true;
      return undefined;
    }),
    api.post(`${CLAIM}/contacts`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "claims:write") ?? locked(claim);
      if (refused) return refused;
      if (claim.contacts.some((c) => c.contact.id === body.contact_id)) {
        return problem(409, "contact_already_linked", {
          detail: "That contact is already linked to this claim; change its role instead",
          contact_id: body.contact_id,
        });
      }
      const known = liveContact(params.organization_id, body.contact_id);
      if (!known) {
        return problem(422, "unknown_contact", {
          detail: "Contacts must exist in this organization",
          contact_ids: [body.contact_id],
        });
      }
      const link: Schema<"ClaimContactRead"> = {
        contact: known.contact,
        role: body.role,
        is_primary: body.is_primary ?? false,
      };
      replaceClaim({
        ...claim,
        contacts: [...withPrimary(claim.contacts, link), link],
        updated_at: iso(),
      });
      record(
        claim.id,
        seen.person,
        "contacts",
        "contact_linked",
        `Added ${link.contact.full_name} as ${link.role.replaceAll("_", " ")}`,
      );
      return link;
    }),
    api.patch(`${CLAIM}/contacts/{contact_id}`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "claims:write") ?? locked(claim);
      if (refused) return refused;
      const current = claim.contacts.find((c) => c.contact.id === params.contact_id);
      if (!current) {
        return problem(404, "not_found", { detail: "That contact is not linked to this claim" });
      }
      const link = {
        ...current,
        role: body.role ?? current.role,
        is_primary: body.is_primary ?? current.is_primary,
      };
      replaceClaim({
        ...claim,
        contacts: withPrimary(claim.contacts, link).map((c) =>
          c.contact.id === link.contact.id ? link : c,
        ),
        updated_at: iso(),
      });
      record(
        claim.id,
        seen.person,
        "contacts",
        "contact_link_updated",
        `Changed ${link.contact.full_name}'s part in the claim`,
      );
      return link;
    }),
    api.delete(`${CLAIM}/contacts/{contact_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "claims:write") ?? locked(claim);
      if (refused) return refused;
      const link = claim.contacts.find((c) => c.contact.id === params.contact_id);
      if (!link) {
        return problem(404, "not_found", { detail: "That contact is not linked to this claim" });
      }
      replaceClaim({
        ...claim,
        contacts: claim.contacts.filter((c) => c !== link),
        updated_at: iso(),
      });
      record(
        claim.id,
        seen.person,
        "contacts",
        "contact_unlinked",
        `Took ${link.contact.full_name} off the claim`,
      );
      return undefined;
    }),

    api.get(`${ORG}/members`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "members:read");
      if (refused) return refused;
      return db()
        .accounts.flatMap(({ user }) =>
          user.memberships
            .filter((m) => m.organization.id === params.organization_id)
            .map((m) => ({
              user: { id: user.id, full_name: user.full_name },
              role: m.role,
              permissions: [...m.permissions].sort(),
              joined_at: MEMBER_SINCE,
            })),
        )
        .sort(
          (a, b) =>
            a.user.full_name.toLowerCase().localeCompare(b.user.full_name.toLowerCase()) ||
            a.user.id.localeCompare(b.user.id),
        );
    }),
    api.get(`${ORG}/tasks/assigned-to-me`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const status = query.get("status");
      const dueBy = query.get("due_by");
      const live = new Set(
        db()
          .claims.filter((c) => c.organizationId === params.organization_id)
          .map((c) => c.claim.id),
      );
      const mine = db()
        .tasks.filter((t) => live.has(t.claim.id) && t.assignee?.id === seen.person.id)
        .filter((t) => status === null || t.done === (status === "done"))
        .filter((t) => dueBy === null || (t.due_on !== null && t.due_on <= dueBy))
        .sort(
          (a, b) =>
            (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.id.localeCompare(b.id),
        );
      return paginate(mine, query);
    }),

    // ─── Notes ───────────────────────────────────────────────────────────────
    api.get(`${CLAIM}/notes`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      return paginate(newestFirst(db().notes.filter((n) => n.claim.id === claim.id)), query);
    }),
    api.post(`${CLAIM}/notes`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "field_data:write") ?? locked(claim);
      if (refused) return refused;
      const mentioned = mentions(body.body);
      if (mentioned instanceof Response) return mentioned;
      const note: Schema<"NoteRead"> = {
        id: newId(),
        claim: { id: claim.id, number: claim.number },
        author: seen.person,
        body: body.body,
        text: render(body.body, mentioned),
        mentions: mentioned,
        edited_at: null,
        created_at: iso(),
        updated_at: iso(),
      };
      db().notes.push(note);
      record(claim.id, seen.person, "notes", "note_created", "Wrote a note");
      return note;
    }),
    api.patch(`${CLAIM}/notes/{note_id}`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const refused = allowed(seen.membership, "field_data:write") ?? locked(claim);
      if (refused) return refused;
      const index = db().notes.findIndex((n) => n.id === params.note_id && n.claim.id === claim.id);
      const note = db().notes[index];
      if (!note) return problem(404, "not_found");
      if (note.author?.id !== seen.person.id) {
        return problem(403, "not_note_author", { detail: "Only the author can edit a note" });
      }
      if (body.body === note.body) return note; // no edit, no edited_at
      const mentioned = mentions(body.body);
      if (mentioned instanceof Response) return mentioned;
      const updated = {
        ...note,
        body: body.body,
        text: render(body.body, mentioned),
        mentions: mentioned,
        edited_at: iso(),
        updated_at: iso(),
      };
      db().notes[index] = updated;
      return updated;
    }),
    api.delete(`${CLAIM}/notes/{note_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const note = db().notes.find((n) => n.id === params.note_id && n.claim.id === claim.id);
      if (!note) return problem(404, "not_found");
      if (note.author?.id !== seen.person.id && allowed(seen.membership, "claims:delete")) {
        return problem(403, "not_note_author", { required_permission: "claims:delete" });
      }
      const refused = locked(claim);
      if (refused) return refused;
      backend.db.notes = db().notes.filter((n) => n.id !== note.id);
      return undefined;
    }),
    api.get(`${ORG}/notes/mentioning-me`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      return paginate(
        newestFirst(db().notes.filter((n) => n.mentions.some((m) => m.id === seen.person.id))),
        query,
      );
    }),
  ];

  return backend;
}
