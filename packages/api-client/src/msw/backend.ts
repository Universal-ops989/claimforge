/**
 * An in-memory ClaimForge API for frontend development and tests.
 *
 *     const backend = createMockBackend({ baseUrl: "https://api.test" });
 *     const server = setupServer(...backend.handlers);   // or setupWorker in a browser
 *
 * It covers what the web app's first screens need: sessions, `/v1/me`, organizations,
 * claims (lists, filters, pages, create, edit, the status workflow, assignments, contacts,
 * history, timeline), the address book, the layout and damage, photos (with a pretend file
 * store behind their upload links), moisture mapping and drying, equipment and its placements,
 * estimates and the price lists they're priced from,
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
import { http, HttpResponse, type HttpHandler } from "msw";

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
  /** Photos; a photo's `room` is read from the layout, so it follows renames and deletes. */
  photos: { claimId: string; photo: Schema<"PhotoRead">; roomId: string | null }[];
  /** Photo uploads started and not yet completed (or completed: `photoId`). */
  photoUploads: {
    id: string;
    claimId: string;
    body: Schema<"PhotoUploadCreate">;
    by: Person;
    photoId: string | null;
  }[];
  /** The pretend file store behind upload links: what was sent, by key. */
  files: Record<string, Blob>;
  /** Moisture points; a point's `room` is read from the layout. */
  moisturePoints: { claimId: string; point: Schema<"MoisturePointRead">; roomId: string }[];
  /** Monitoring visits: the readings and air as entered; labels and air figures are worked out. */
  moistureLogs: {
    claimId: string;
    id: string;
    taken_at: string;
    taken_by: Person | null;
    notes: string | null;
    readings: { point_id: string; value: number }[];
    atmosphere: Schema<"AtmosphereIn">[];
    readings_edited_at: string | null;
    created_at: string;
    updated_at: string;
  }[];
  /** The organizations' drying equipment; a unit's current placement is worked out. */
  equipment: { organizationId: string; unit: Omit<Schema<"EquipmentRead">, "current_placement"> }[];
  /** Where units have been placed; `removed_at` null while running. */
  placements: {
    claimId: string;
    id: string;
    equipmentId: string;
    roomId: string;
    placed_at: string;
    removed_at: string | null;
    placed_by: Person | null;
    removed_by: Person | null;
  }[];
  /** Price lists and their items; one list per organization is the default. */
  priceLists: {
    organizationId: string;
    list: Omit<Schema<"PriceListRead">, "item_count">;
    items: Schema<"PriceItemRead">[];
  }[];
  /** Estimates, their lines in order; totals are worked out as the API does. */
  estimates: {
    claimId: string;
    estimate: Omit<
      Schema<"EstimateRead">,
      "totals" | "rooms" | "total" | "next_statuses" | "lines"
    >;
    lines: Omit<Schema<"LineRead">, "total" | "position" | "room">[];
    roomIds: (string | null)[];
  }[];
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
    priceLists: [
      {
        organizationId: fx.ids.organization,
        list: (({ item_count: _, ...list }) => list)(fx.priceList()),
        items: [
          ["WTR-DEHU", "Dehumidifier, per day", "DA", "85.00", "Water mitigation"],
          ["WTR-AIRM", "Air mover, per day", "DA", "28.00", "Water mitigation"],
          ["WTR-EXTR", "Water extraction from carpet", "SF", "0.45", "Water mitigation"],
          ["DRY-RMVF", "Drywall, flood cut to 2 ft", "LF", "3.10", "Demolition"],
          ["DRY-INST", "Drywall, hang, tape and finish", "SF", "2.85", "Rebuild"],
          ["FLR-LAMN", "Laminate flooring, install", "SF", "4.60", "Rebuild"],
          ["ANT-APPL", "Antimicrobial, apply", "SF", "0.32", "Water mitigation"],
        ].map(([code, description, unit, unit_price, category], i) =>
          fx.priceItem({
            id: fx.fixtureId("priceItem", i + 1),
            code,
            description,
            unit,
            unit_price,
            category,
          }),
        ),
      },
    ],
    estimates: [
      {
        claimId: fx.ids.claim,
        estimate: {
          id: fx.ids.estimate,
          claim_id: fx.ids.claim,
          number: 1,
          title: "Mitigation",
          status: "draft",
          notes: null,
          price_list: { id: fx.ids.priceList, name: "Lone Star 2026" },
          tax_percent: "8.25",
          overhead_percent: "10",
          profit_percent: "10",
          created_by: fx.people.morgan,
          created_at: "2026-11-15T16:00:00Z",
          updated_at: "2026-11-15T16:00:00Z",
        },
        lines: [
          {
            id: fx.fixtureId("line", 1),
            code: "WTR-DEHU",
            description: "Dehumidifier, per day",
            unit: "DA",
            quantity: "3",
            unit_price: "85.00",
            taxable: false,
            notes: null,
            price_item_id: fx.fixtureId("priceItem", 1),
          },
          {
            id: fx.fixtureId("line", 2),
            code: "WTR-AIRM",
            description: "Air mover, per day",
            unit: "DA",
            quantity: "6",
            unit_price: "28.00",
            taxable: false,
            notes: null,
            price_item_id: fx.fixtureId("priceItem", 2),
          },
        ],
        roomIds: [fx.ids.room, fx.ids.room],
      },
    ],
    photos: [{ claimId: fx.ids.claim, photo: fx.photo(), roomId: fx.ids.room }],
    moisturePoints: [{ claimId: fx.ids.claim, point: fx.moisturePoint(), roomId: fx.ids.room }],
    equipment: [
      fx.equipment(),
      fx.equipment({
        id: fx.fixtureId("equipment", 2),
        kind: "air_mover",
        name: "Air mover",
        asset_tag: "AM-01",
        capacity: 2400,
        capacity_unit: "cfm",
      }),
      fx.equipment({
        id: fx.fixtureId("equipment", 3),
        kind: "air_mover",
        name: "Air mover",
        asset_tag: "AM-02",
        capacity: 2400,
        capacity_unit: "cfm",
      }),
    ].map(({ current_placement: _, ...unit }) => ({ organizationId: fx.ids.organization, unit })),
    placements: [fx.ids.equipment, fx.fixtureId("equipment", 2)].map((equipmentId, i) => ({
      claimId: fx.ids.claim,
      id: fx.fixtureId("placement", i + 1),
      equipmentId,
      roomId: fx.ids.room,
      placed_at: "2026-11-14T16:00:00Z",
      removed_at: null,
      placed_by: fx.people.riley,
      removed_by: null,
    })),
    moistureLogs: [
      ["2026-11-14T15:00:00Z", 28, 2],
      ["2026-11-15T15:00:00Z", 22, 3],
      ["2026-11-16T15:00:00Z", 18, 1],
    ].map(([taken_at, value, n]) => ({
      claimId: fx.ids.claim,
      id: fx.fixtureId("log", n as number),
      taken_at: taken_at as string,
      taken_by: fx.people.riley,
      notes: null,
      readings: [{ point_id: fx.ids.point, value: value as number }],
      atmosphere: [
        {
          location: "room" as const,
          room_id: fx.ids.room,
          temperature_f: 72,
          relative_humidity: 55,
        },
      ],
      readings_edited_at: null,
      created_at: taken_at as string,
      updated_at: taken_at as string,
    })),
    photoUploads: [],
    files: {},
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
/** Readings in a row without improving before a point counts as stalled. */
const STALL_READINGS = 3;
/** Longer than this between visits, with points still drying, is a gap in monitoring. */
const MONITORING_INTERVAL_MS = 24 * 3_600_000;
/** A billable equipment-day: every started 24 hours counts. */
const DAY_MS = 24 * 3_600_000;
/** How each kind's capacity is rated, as the API has it; kinds without one have none. */
const CAPACITY_UNITS: Partial<Record<Schema<"EquipmentKind">, Schema<"CapacityUnit">>> = {
  dehumidifier: "pints_per_day",
  desiccant_dehumidifier: "cfm",
  air_mover: "cfm",
  air_scrubber: "cfm",
  heater: "btu_per_hour",
};
const DEHUMIDIFIERS: Schema<"EquipmentKind">[] = ["dehumidifier", "desiccant_dehumidifier"];

/** Billable days from placed to removed (or now): every started 24 hours, at least one. */
export function equipmentDays(placedAt: string, until: string | number): number {
  const ms = Math.max(new Date(until).getTime() - Date.parse(placedAt), 0);
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

/** How far ahead of the server's clock a visit may say it was taken. */
const CLOCK_SKEW_MS = 10 * 60_000;

const tenth = (n: number) => Math.round(n * 10) / 10;

/** Grains of water per pound of dry air, at sea level: the API's psychrometrics. */
export function grainsPerPound(temperatureF: number, relativeHumidity: number): number {
  const t = ((temperatureF - 32) * 5) / 9 + 273.15;
  const saturationPa = Math.exp(
    -5.8002206e3 / t +
      1.3914993 -
      4.8640239e-2 * t +
      4.1764768e-5 * t ** 2 -
      1.4452093e-8 * t ** 3 +
      6.5459673 * Math.log(t),
  );
  const vapourHpa = (relativeHumidity / 100) * (saturationPa / 100);
  return tenth(((0.621945 * vapourHpa) / (1013.25 - vapourHpa)) * 7000);
}

/** The dew point in °F (Magnus), or `null` for bone-dry air. */
export function dewPointF(temperatureF: number, relativeHumidity: number): number | null {
  if (relativeHumidity <= 0) return null;
  const celsius = ((temperatureF - 32) * 5) / 9;
  const gamma = Math.log(relativeHumidity / 100) + (17.625 * celsius) / (243.04 + celsius);
  return tenth((((243.04 * gamma) / (17.625 - gamma)) * 9) / 5 + 32);
}

/** Labels as people number them: "2" before "10", then the rest alphabetically. */
function byLabel(a: string, b: string): number {
  const [x, y] = [Number(a), Number(b)];
  const numeric = /^\d+$/.test(a) && /^\d+$/.test(b);
  return numeric ? x - y : a.localeCompare(b, undefined, { numeric: true });
}

type DryingState = Schema<"DryingStatus">;

/** A point's progress from its readings, oldest first: the API's rule. */
function progress(
  readings: { at: string; value: number }[],
  goal: number | null,
): { status: DryingState; driedAt: string | null } {
  const latest = readings.at(-1);
  if (!latest) return { status: "not_read", driedAt: null };
  if (goal === null) return { status: "no_goal", driedAt: null };
  if (latest.value > goal) return { status: "drying", driedAt: null };
  let driedAt = latest.at;
  for (const reading of [...readings].reverse()) {
    if (reading.value > goal) break;
    driedAt = reading.at;
  }
  return { status: "dry", driedAt };
}

/** The largest photo the API takes (its `photo_max_bytes`). */
const PHOTO_MAX_BYTES = 25 * 1024 * 1024;
/** How long an upload link works. */
const UPLOAD_LINK_MS = 30 * 60_000;

/** Tags as the API keeps them: lowercase, single-spaced, without repeats, alphabetical. */
function normalTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().split(/\s+/).join(" ").toLowerCase()))]
    .filter(Boolean)
    .sort();
}

/** An address on one line, as the API writes it: "123 N Main St Apt 4B, Austin, TX 78701". */
function oneLine(address: Schema<"AddressInput">): string {
  const street = [address.line1, address.line2].filter(Boolean).join(" ");
  const place = [address.region, address.postal_code].filter(Boolean).join(" ");
  return [street, address.city, place].filter(Boolean).join(", ");
}

/** What makes two addresses the same place: case and spacing aside. */
const addressKey = (address: Schema<"AddressInput">) =>
  [address.line1, address.line2, address.city, address.region, address.postal_code, address.country]
    .map((part) => (part ?? "").trim().toLowerCase().split(/\s+/).join(" "))
    .join("|");

/** Text, trimmed; blank (or none) is `null`, as the API stores it. */
function textOrNull(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
}

/** What the pretend store serves for a seeded photo, which has no file: a drawn stand-in. */
const PLACEHOLDER_PHOTO = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<rect width="1200" height="900" fill="#d9dee5"/>
<rect x="0" y="560" width="1200" height="340" fill="#c3b49a"/>
<path d="M0 560 L1200 560" stroke="#a89878" stroke-width="6"/>
<ellipse cx="760" cy="300" rx="190" ry="120" fill="#b9a27a" opacity=".55"/>
<ellipse cx="760" cy="300" rx="120" ry="70" fill="#9c8257" opacity=".5"/>
<rect x="690" y="270" width="140" height="60" rx="6" fill="#eef1f4" stroke="#8a95a3" stroke-width="4"/>
<text x="60" y="110" font-family="sans-serif" font-size="44" fill="#4a5563">Sample photo</text>
</svg>`;

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

  /** Where the pretend file store answers: next to the API. */
  const STORAGE = `${(options.baseUrl ?? "").replace(/\/+$/, "")}/__mock-storage`;
  const fileUrl = (key: string) => `${STORAGE}/files/${key}`;
  /** The seed, its photos' links pointing at the pretend store (which draws them). */
  const seeded = (): MockDb => {
    const data = seed();
    data.photos = data.photos.map((entry) => {
      const url = fileUrl(entry.photo.id);
      return {
        ...entry,
        photo: {
          ...entry.photo,
          url,
          download_url: `${url}?download=1`,
          thumbnail_url: url,
          preview_url: url,
        },
      };
    });
    return data;
  };

  const backend: MockBackend = { handlers: [], db: seeded(), reset };
  let sessions = newSessions();
  let sequence = 0;

  function reset(): void {
    backend.db = seeded();
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

  /** `has_moisture_points` if any of `roomIds` has points mapped: drying records stay. */
  function hasPoints(roomIds: string[]): Response | null {
    const count = db().moisturePoints.filter((p) => roomIds.includes(p.roomId)).length;
    return count > 0
      ? problem(409, "has_moisture_points", {
          detail: `${String(count)} moisture point(s) are mapped here; drying records stay with their room`,
          points: count,
        })
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

  type Placement = MockDb["placements"][number];

  /** A unit as the API answers it: where it's running now, if anywhere. */
  function unitNow(entry: MockDb["equipment"][number]): Schema<"EquipmentRead"> {
    const running = db().placements.find(
      (p) => p.equipmentId === entry.unit.id && p.removed_at === null,
    );
    const claim = running && db().claims.find((c) => c.claim.id === running.claimId)?.claim;
    return {
      ...entry.unit,
      current_placement:
        running && claim
          ? {
              id: running.id,
              claim: { id: claim.id, number: claim.number },
              room_id: running.roomId,
              placed_at: running.placed_at,
            }
          : null,
    };
  }

  /** A placement as the API answers it: the unit, the room, and its days so far. */
  function placementNow(p: Placement): Schema<"PlacementRead"> {
    const unit = db().equipment.find((e) => e.unit.id === p.equipmentId)?.unit;
    return {
      id: p.id,
      equipment: {
        id: p.equipmentId,
        kind: unit?.kind ?? "other",
        name: unit?.name ?? "",
        asset_tag: unit?.asset_tag ?? "",
      },
      room: roomRef(p.roomId) ?? { id: p.roomId, name: "" },
      placed_at: p.placed_at,
      removed_at: p.removed_at,
      running: p.removed_at === null,
      days: equipmentDays(p.placed_at, p.removed_at ?? now()),
      placed_by: p.placed_by,
      removed_by: p.removed_by,
    };
  }

  function unitOf(organizationId: string, equipmentId: string) {
    return db().equipment.find(
      (e) => e.organizationId === organizationId && e.unit.id === equipmentId,
    );
  }

  /** `equipment_running` if the unit is running somewhere (other than `except`). */
  function runningElsewhere(equipmentId: string, except?: string): Response | null {
    const running = db().placements.find(
      (p) => p.equipmentId === equipmentId && p.removed_at === null && p.id !== except,
    );
    if (!running) return null;
    const claim = db().claims.find((c) => c.claim.id === running.claimId)?.claim;
    return problem(409, "equipment_running", {
      detail: `That unit is running on claim ${claim?.number ?? ""}; remove it there first`,
      claim_id: running.claimId,
      claim_number: claim?.number ?? "",
    });
  }

  const inFuture = (iso: string) => Date.parse(iso) > now() + CLOCK_SKEW_MS;
  const futureTime = () =>
    problem(422, "time_in_future", {
      detail: "Equipment can't be placed or removed in the future",
    });

  type EstimateEntry = MockDb["estimates"][number];

  /** An estimate as the API answers it: its lines numbered and priced, its totals worked out. */
  function estimateNow(entry: EstimateEntry): Schema<"EstimateRead"> {
    const lines = entry.lines.map((line, i) =>
      fx.estimateLine({ ...line, position: i + 1, room: roomRef(entry.roomIds[i]) }),
    );
    // The fixture works totals, room subtotals and next statuses out as the API does.
    return fx.estimate({ ...entry.estimate, lines });
  }

  function summaryOf(entry: EstimateEntry): Schema<"EstimateSummary"> {
    const { id, claim_id, number, title, status, total, created_at, updated_at } =
      estimateNow(entry);
    return { id, claim_id, number, title, status, total, created_at, updated_at };
  }

  function estimateOf(claimId: string, estimateId: string) {
    return db().estimates.find((e) => e.claimId === claimId && e.estimate.id === estimateId);
  }

  /** `estimate_not_draft` unless the estimate can still be changed. */
  function notDraft(entry: EstimateEntry): Response | null {
    return entry.estimate.status === "draft"
      ? null
      : problem(409, "estimate_not_draft", {
          detail: `Estimate ${String(entry.estimate.number)} is ${entry.estimate.status}; move it back to draft first`,
          estimate_status: entry.estimate.status,
        });
  }

  function priceListOf(organizationId: string, listId: string) {
    return db().priceLists.find((l) => l.organizationId === organizationId && l.list.id === listId);
  }

  /** Estimate work on a claim: `estimates:write`, an open claim; or the refusal. */
  function estimateWork(request: Request, organizationId: string, claimId: string) {
    const seen = member(request, organizationId);
    if (seen instanceof Response) return seen;
    const claim = claimOr404(organizationId, claimId);
    if (claim instanceof Response) return claim;
    return allowed(seen.membership, "estimates:write") ?? locked(claim) ?? { seen, claim };
  }

  /** A stored point as the API answers it: its room as the layout has it now. */
  function pointNow(entry: { point: Schema<"MoisturePointRead">; roomId: string }) {
    const room = db()
      .structures.flatMap((s) => s.structure.rooms)
      .find((r) => r.id === entry.roomId);
    return { ...entry.point, room: { id: entry.roomId, name: room?.name ?? "" } };
  }

  /** A claim's points: room by room, in the order rooms were added, then by label. */
  function pointsOf(claimId: string) {
    const rooms = layoutOf(claimId).flatMap((s) => s.rooms.map((r) => r.id));
    return db()
      .moisturePoints.filter((p) => p.claimId === claimId)
      .sort(
        (a, b) =>
          rooms.indexOf(a.roomId) - rooms.indexOf(b.roomId) ||
          byLabel(a.point.label, b.point.label),
      );
  }

  /** A claim's visits, oldest first. */
  function visitsOf(claimId: string) {
    return db()
      .moistureLogs.filter((l) => l.claimId === claimId)
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at) || a.id.localeCompare(b.id));
  }

  function roomRef(roomId: string | null | undefined) {
    if (!roomId) return null;
    const room = db()
      .structures.flatMap((s) => s.structure.rooms)
      .find((r) => r.id === roomId);
    return room ? { id: room.id, name: room.name } : null;
  }

  function placementRoom(placementId: string | null | undefined): string | null {
    return db().placements.find((p) => p.id === placementId)?.roomId ?? null;
  }

  function dehumidifierRef(placementId: string | null | undefined) {
    const placed = db().placements.find((p) => p.id === placementId);
    const unit = placed && db().equipment.find((e) => e.unit.id === placed.equipmentId)?.unit;
    return placed && unit ? { placement_id: placed.id, asset_tag: unit.asset_tag } : null;
  }

  /** A stored visit as the API answers it: labels on readings, air worked out. */
  function logNow(log: MockDb["moistureLogs"][number]): Schema<"MoistureLogRead"> {
    const labels = new Map(db().moisturePoints.map((p) => [p.point.id, p.point.label]));
    return {
      id: log.id,
      taken_at: log.taken_at,
      taken_by: log.taken_by,
      notes: log.notes,
      readings: log.readings.map((r) => ({ ...r, label: labels.get(r.point_id) ?? "" })),
      atmosphere: log.atmosphere.map((air) => ({
        location: air.location,
        room: roomRef(air.room_id ?? placementRoom(air.placement_id)),
        dehumidifier: dehumidifierRef(air.placement_id),
        temperature_f: air.temperature_f,
        relative_humidity: air.relative_humidity,
        grains_per_pound: grainsPerPound(air.temperature_f, air.relative_humidity),
        dew_point_f: dewPointF(air.temperature_f, air.relative_humidity),
      })),
      readings_edited_at: log.readings_edited_at,
      created_at: log.created_at,
      updated_at: log.updated_at,
    };
  }

  /**
   * Readings and air for a visit, checked as the API checks them: points of this claim
   * (`unknown_moisture_point`), rooms of this claim, and no dehumidifiers (the mock has no
   * equipment). `null` when they're fine.
   */
  function visitProblem(
    claimId: string,
    readings: { point_id: string }[],
    atmosphere: Schema<"AtmosphereIn">[],
  ): Response | null {
    const known = new Set(
      db()
        .moisturePoints.filter((p) => p.claimId === claimId)
        .map((p) => p.point.id),
    );
    const unknown = readings.filter((r) => !known.has(r.point_id)).map((r) => r.point_id);
    if (unknown.length > 0) {
      return problem(422, "unknown_moisture_point", {
        detail: "Readings are for moisture points mapped on this claim",
        point_ids: unknown,
      });
    }
    const badRoom = atmosphere.find((air) => air.room_id && !claimRoom(claimId, air.room_id));
    if (badRoom?.room_id) return unknownRoom(badRoom.room_id);
    const notDehumidifier = atmosphere.find((air) => {
      if (!air.placement_id) return false;
      const placed = db().placements.find(
        (p) => p.claimId === claimId && p.id === air.placement_id,
      );
      const unit = placed && db().equipment.find((e) => e.unit.id === placed.equipmentId)?.unit;
      return !unit || !DEHUMIDIFIERS.includes(unit.kind);
    });
    if (notDehumidifier) {
      return problem(422, "unknown_dehumidifier", {
        detail: "Exhaust readings are for dehumidifiers placed on this claim",
        placement_id: notDehumidifier.placement_id,
      });
    }
    return null;
  }

  /** A stored photo as the API answers it: its room as the layout has it now. */
  function photoNow(entry: { photo: Schema<"PhotoRead">; roomId: string | null }) {
    const room = entry.roomId
      ? db()
          .structures.flatMap((s) => s.structure.rooms)
          .find((r) => r.id === entry.roomId)
      : undefined;
    return { ...entry.photo, room: room ? { id: room.id, name: room.name } : null };
  }

  function claimRoom(claimId: string, roomId: string) {
    return layoutOf(claimId)
      .flatMap((s) => s.rooms)
      .find((r) => r.id === roomId);
  }

  const unknownRoom = (roomId: string) =>
    problem(422, "unknown_room", {
      detail: "Photos can only go in a room of the same claim",
      room_id: roomId,
    });

  backend.handlers = [
    // ─── The pretend file store ──────────────────────────────────────────────
    http.put(`${STORAGE || "*"}/uploads/:key`, async ({ request, params }) => {
      backend.db.files[String(params.key)] = await request.blob();
      return new HttpResponse(null, { status: 200 });
    }),
    http.get(`${STORAGE || "*"}/files/:key`, async ({ params }) => {
      const file = db().files[String(params.key)];
      if (!file) {
        return new HttpResponse(PLACEHOLDER_PHOTO, {
          headers: { "Content-Type": "image/svg+xml" },
        });
      }
      // The bytes, not the Blob: a Blob from another realm (jsdom's) would be sent as text.
      return new HttpResponse(await file.arrayBuffer(), {
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
    }),

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
      const mapped = hasPoints([...rooms]);
      if (mapped) return mapped;
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
      // Drying records stay with their room.
      const mapped = hasPoints([room.id]);
      if (mapped) return mapped;
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

    // ─── Photos ──────────────────────────────────────────────────────────────
    api.post(`${CLAIM}/photo-uploads`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      if (body.room_id && !claimRoom(ready.claim.id, body.room_id))
        return unknownRoom(body.room_id);
      if (body.size_bytes > PHOTO_MAX_BYTES) {
        return problem(422, "photo_too_large", {
          detail: `Photos can be up to ${String(PHOTO_MAX_BYTES / 1024 / 1024)} MB`,
          limit: PHOTO_MAX_BYTES,
        });
      }
      const id = newId();
      db().photoUploads.push({
        id,
        claimId: ready.claim.id,
        body,
        by: ready.seen.person,
        photoId: null,
      });
      return {
        id,
        upload: {
          url: `${STORAGE}/uploads/${id}`,
          method: "PUT" as const,
          headers: { "Content-Type": body.content_type },
          // Real time, not the mock's clock: the client checks links against its own.
          expires_at: new Date(Math.max(now(), Date.now()) + UPLOAD_LINK_MS).toISOString(),
        },
      };
    }),
    api.post(`${CLAIM}/photo-uploads/{upload_id}/complete`, ({ request, params, respond }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const upload = db().photoUploads.find(
        (u) => u.claimId === params.claim_id && u.id === params.upload_id,
      );
      if (!upload) return problem(404, "not_found");
      const done = upload.photoId && db().photos.find((p) => p.photo.id === upload.photoId);
      // Completing again is safe: the same photo, with 200.
      if (done) return respond(200, photoNow(done));
      const file = db().files[upload.id];
      if (!file) {
        return problem(409, "upload_not_received", { detail: "The file hasn't been sent yet" });
      }
      if (
        file.size !== upload.body.size_bytes ||
        (file.type && file.type !== upload.body.content_type)
      ) {
        backend.db.files = Object.fromEntries(
          Object.entries(db().files).filter(([key]) => key !== upload.id),
        );
        return problem(422, "upload_mismatch", {
          detail: "The file sent isn't the one described; send it again",
          expected_size: upload.body.size_bytes,
          received_size: file.size,
        });
      }
      const photo: Schema<"PhotoRead"> = {
        id: newId(),
        claim_id: upload.claimId,
        filename: upload.body.filename,
        content_type: upload.body.content_type,
        size_bytes: upload.body.size_bytes,
        taken_at: upload.body.taken_at ?? null,
        uploaded_by: upload.by,
        caption: textOrNull(upload.body.caption),
        tags: normalTags(upload.body.tags ?? []),
        room: null,
        created_at: iso(),
        url: fileUrl(upload.id),
        download_url: `${fileUrl(upload.id)}?download=1`,
        // No thumbnails to make: the mock serves the photo itself at every size.
        processing: "ready",
        width: null,
        height: null,
        thumbnail_url: fileUrl(upload.id),
        preview_url: fileUrl(upload.id),
      };
      const entry = { claimId: upload.claimId, photo, roomId: upload.body.room_id ?? null };
      db().photos.push(entry);
      upload.photoId = photo.id;
      record(
        upload.claimId,
        upload.by,
        "photos",
        "photo_uploaded",
        `Added a photo${entry.roomId ? ` of the ${photoNow(entry).room?.name ?? "room"}` : ""}`,
      );
      return photoNow(entry);
    }),
    api.get(`${CLAIM}/photos`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const roomId = query.get("room_id");
      const unassigned = query.get("unassigned") === "true";
      const tags = normalTags(query.getAll("tag"));
      const found = db()
        .photos.filter((p) => p.claimId === claim.id)
        .map(photoNow)
        .filter(
          (p) =>
            (!roomId || p.room?.id === roomId) &&
            (!unassigned || p.room === null) &&
            tags.every((t) => p.tags.includes(t)),
        );
      return paginate(newestFirst(found), query);
    }),
    api.get(`${CLAIM}/photos/{photo_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const entry = db().photos.find(
        (p) => p.claimId === params.claim_id && p.photo.id === params.photo_id,
      );
      return entry ? photoNow(entry) : problem(404, "not_found");
    }),
    api.patch(`${CLAIM}/photos/{photo_id}`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().photos.find(
        (p) => p.claimId === ready.claim.id && p.photo.id === params.photo_id,
      );
      if (!entry) return problem(404, "not_found");
      if ("room_id" in body) {
        if (body.room_id && !claimRoom(ready.claim.id, body.room_id))
          return unknownRoom(body.room_id);
        entry.roomId = body.room_id ?? null;
      }
      if ("caption" in body) entry.photo.caption = textOrNull(body.caption);
      if (body.tags) entry.photo.tags = normalTags(body.tags);
      record(ready.claim.id, ready.seen.person, "photos", "photo_updated", "Edited a photo");
      return photoNow(entry);
    }),
    api.delete(`${CLAIM}/photos/{photo_id}`, ({ request, params }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().photos.find(
        (p) => p.claimId === ready.claim.id && p.photo.id === params.photo_id,
      );
      if (!entry) return problem(404, "not_found");
      backend.db.photos = db().photos.filter((p) => p !== entry);
      record(ready.claim.id, ready.seen.person, "photos", "photo_deleted", "Deleted a photo");
      return undefined;
    }),
    api.get(`${ORG}/photo-tags`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const prefix = (query.get("prefix") ?? "").trim().toLowerCase();
      const limit = Number(query.get("limit") ?? 20);
      const claims = new Set(
        db()
          .claims.filter((c) => c.organizationId === params.organization_id)
          .map((c) => c.claim.id),
      );
      const counts = new Map<string, number>();
      for (const { claimId, photo } of db().photos) {
        if (!claims.has(claimId)) continue;
        for (const tag of photo.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      return [...counts]
        .filter(([tag]) => tag.startsWith(prefix))
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .slice(0, limit)
        .map(([tag, photos]) => ({ tag, photos }));
    }),

    // ─── Moisture ────────────────────────────────────────────────────────────
    api.get(`${CLAIM}/moisture-points`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const roomId = query.get("room_id");
      return pointsOf(claim.id)
        .filter((p) => !roomId || p.roomId === roomId)
        .map(pointNow);
    }),
    api.get(`${CLAIM}/moisture-points/{point_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const entry = db().moisturePoints.find(
        (p) => p.claimId === params.claim_id && p.point.id === params.point_id,
      );
      return entry ? pointNow(entry) : problem(404, "not_found");
    }),
    api.post(`${CLAIM}/moisture-points`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      if (!claimRoom(ready.claim.id, body.room_id)) return unknownRoom(body.room_id);
      const labels = db()
        .moisturePoints.filter((p) => p.claimId === ready.claim.id)
        .map((p) => p.point.label);
      const label =
        body.label?.trim() ??
        String(Math.max(0, ...labels.filter((l) => /^\d+$/.test(l)).map(Number)) + 1);
      if (labels.includes(label)) {
        return problem(409, "label_taken", {
          detail: `Point ${label} is already mapped on this claim`,
        });
      }
      const entry = {
        claimId: ready.claim.id,
        roomId: body.room_id,
        point: {
          id: newId(),
          label,
          room: { id: body.room_id, name: "" },
          surface: body.surface,
          material: body.material.trim(),
          scale: body.scale,
          dry_standard: body.dry_standard ?? null,
          dry_standard_basis:
            body.dry_standard === null || body.dry_standard === undefined
              ? null
              : (body.dry_standard_basis ?? "manual"),
          notes: textOrNull(body.notes),
          created_at: iso(),
          updated_at: iso(),
        },
      };
      db().moisturePoints.push(entry);
      record(
        ready.claim.id,
        ready.seen.person,
        "moisture",
        "point_mapped",
        `Mapped moisture point ${label}`,
      );
      return pointNow(entry);
    }),
    api.patch(`${CLAIM}/moisture-points/{point_id}`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().moisturePoints.find(
        (p) => p.claimId === ready.claim.id && p.point.id === params.point_id,
      );
      if (!entry) return problem(404, "not_found");
      if (body.room_id) {
        if (!claimRoom(ready.claim.id, body.room_id)) return unknownRoom(body.room_id);
        entry.roomId = body.room_id;
      }
      if (body.label != null) {
        const label = body.label.trim();
        const taken = db().moisturePoints.some(
          (p) => p.claimId === ready.claim.id && p !== entry && p.point.label === label,
        );
        if (taken)
          return problem(409, "label_taken", {
            detail: `Point ${label} is already mapped on this claim`,
          });
        entry.point.label = label;
      }
      if (body.material != null) entry.point.material = body.material.trim();
      if (body.surface != null) entry.point.surface = body.surface;
      if ("notes" in body) entry.point.notes = textOrNull(body.notes);
      if ("dry_standard" in body) {
        entry.point.dry_standard = body.dry_standard ?? null;
        entry.point.dry_standard_basis =
          entry.point.dry_standard === null ? null : (body.dry_standard_basis ?? "manual");
      } else if (body.dry_standard_basis != null && entry.point.dry_standard !== null) {
        entry.point.dry_standard_basis = body.dry_standard_basis;
      }
      entry.point.updated_at = iso();
      return pointNow(entry);
    }),
    api.delete(`${CLAIM}/moisture-points/{point_id}`, ({ request, params }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = db().moisturePoints.find(
        (p) => p.claimId === ready.claim.id && p.point.id === params.point_id,
      );
      if (!entry) return problem(404, "not_found");
      backend.db.moisturePoints = db().moisturePoints.filter((p) => p !== entry);
      // Its readings go with it; a visit left with nothing goes too.
      backend.db.moistureLogs = db()
        .moistureLogs.map((log) => ({
          ...log,
          readings: log.readings.filter((r) => r.point_id !== entry.point.id),
        }))
        .filter((log) => log.readings.length > 0 || log.atmosphere.length > 0);
      record(
        ready.claim.id,
        ready.seen.person,
        "moisture",
        "point_deleted",
        `Deleted moisture point ${entry.point.label}`,
      );
      return undefined;
    }),
    api.get(`${CLAIM}/moisture-logs`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      return paginate(visitsOf(claim.id).reverse().map(logNow), query);
    }),
    api.get(`${CLAIM}/moisture-logs/{log_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const log = db().moistureLogs.find(
        (l) => l.claimId === params.claim_id && l.id === params.log_id,
      );
      return log ? logNow(log) : problem(404, "not_found");
    }),
    api.post(`${CLAIM}/moisture-logs`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const readings = body.readings ?? [];
      const atmosphere = body.atmosphere ?? [];
      if (readings.length === 0 && atmosphere.length === 0) {
        return problem(422, "no_readings", { detail: "A visit needs a reading or the air" });
      }
      const takenAt = body.taken_at ?? iso();
      if (Date.parse(takenAt) > now() + CLOCK_SKEW_MS) {
        return problem(422, "taken_in_future", { detail: "Readings can't be from the future" });
      }
      const refused = visitProblem(ready.claim.id, readings, atmosphere);
      if (refused) return refused;
      const log: MockDb["moistureLogs"][number] = {
        claimId: ready.claim.id,
        id: newId(),
        taken_at: new Date(takenAt).toISOString(),
        taken_by: ready.seen.person,
        notes: textOrNull(body.notes),
        readings: readings.map((r) => ({ point_id: r.point_id, value: tenth(r.value) })),
        atmosphere,
        readings_edited_at: null,
        created_at: iso(),
        updated_at: iso(),
      };
      db().moistureLogs.push(log);
      record(
        ready.claim.id,
        ready.seen.person,
        "moisture",
        "readings_logged",
        `Logged ${String(readings.length)} moisture ${readings.length === 1 ? "reading" : "readings"}`,
      );
      return logNow(log);
    }),
    api.patch(`${CLAIM}/moisture-logs/{log_id}`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const log = db().moistureLogs.find(
        (l) => l.claimId === ready.claim.id && l.id === params.log_id,
      );
      if (!log) return problem(404, "not_found");
      const changes = body.readings ?? [];
      const refused = visitProblem(ready.claim.id, changes, body.atmosphere ?? []);
      if (refused) return refused;
      let readings = log.readings;
      for (const change of changes) {
        readings = readings.filter((r) => r.point_id !== change.point_id);
        if (change.value !== null)
          readings.push({ point_id: change.point_id, value: tenth(change.value) });
      }
      const atmosphere = body.atmosphere ?? log.atmosphere;
      if (readings.length === 0 && atmosphere.length === 0) {
        return problem(422, "no_readings", {
          detail: "A visit keeps a reading or the air; delete it instead",
        });
      }
      if (body.taken_at) {
        if (Date.parse(body.taken_at) > now() + CLOCK_SKEW_MS) {
          return problem(422, "taken_in_future", { detail: "Readings can't be from the future" });
        }
        log.taken_at = new Date(body.taken_at).toISOString();
      }
      if ("notes" in body) log.notes = textOrNull(body.notes);
      if (changes.length > 0) log.readings_edited_at = iso();
      log.readings = readings;
      log.atmosphere = atmosphere;
      log.updated_at = iso();
      return logNow(log);
    }),
    api.delete(`${CLAIM}/moisture-logs/{log_id}`, ({ request, params }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const log = db().moistureLogs.find(
        (l) => l.claimId === ready.claim.id && l.id === params.log_id,
      );
      if (!log) return problem(404, "not_found");
      backend.db.moistureLogs = db().moistureLogs.filter((l) => l !== log);
      return undefined;
    }),
    api.get(`${CLAIM}/drying-log`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const roomId = query.get("room_id");
      const visits = visitsOf(claim.id);
      const points = pointsOf(claim.id).filter((p) => !roomId || p.roomId === roomId);
      const rooms: Schema<"DryingLogRoom">[] = [];
      for (const entry of points) {
        const series = visits.map(
          (v) => v.readings.find((r) => r.point_id === entry.point.id)?.value ?? null,
        );
        const read = visits.flatMap((v, i) =>
          series[i] === null || series[i] === undefined
            ? []
            : [{ at: v.taken_at, value: series[i] }],
        );
        const state = progress(read, entry.point.dry_standard);
        const point: Schema<"DryingLogPoint"> = {
          id: entry.point.id,
          label: entry.point.label,
          material: entry.point.material,
          surface: entry.point.surface,
          scale: entry.point.scale,
          dry_standard: entry.point.dry_standard,
          dry_standard_basis: entry.point.dry_standard_basis,
          status: state.status,
          dried_at: state.driedAt,
          values: series,
        };
        const room = rooms.find((r) => r.id === entry.roomId);
        if (room) room.points.push(point);
        else
          rooms.push({
            id: entry.roomId,
            name: roomRef(entry.roomId)?.name ?? "",
            points: [point],
          });
      }
      // The air: one row per place it was read, in the order first read.
      const places: {
        location: Schema<"AtmosphereLocation">;
        roomId: string | null;
        placementId: string | null;
      }[] = [];
      const placeOf = (air: Schema<"AtmosphereIn">) => ({
        location: air.location,
        roomId: air.room_id ?? placementRoom(air.placement_id),
        placementId: air.placement_id ?? null,
      });
      for (const visit of visits) {
        for (const air of visit.atmosphere) {
          const place = placeOf(air);
          if (
            roomId &&
            air.location !== "outdoors" &&
            air.location !== "unaffected" &&
            place.roomId !== roomId
          )
            continue;
          if (
            !places.some(
              (p) =>
                p.location === place.location &&
                p.roomId === place.roomId &&
                p.placementId === place.placementId,
            )
          ) {
            places.push(place);
          }
        }
      }
      const atmosphere = places.map((place) => ({
        location: place.location,
        room: roomRef(place.roomId),
        dehumidifier: dehumidifierRef(place.placementId),
        values: visits.map((visit) => {
          const air = visit.atmosphere.find((a) => {
            const at = placeOf(a);
            return (
              at.location === place.location &&
              at.roomId === place.roomId &&
              at.placementId === place.placementId
            );
          });
          if (!air) return null;
          const grains = grainsPerPound(air.temperature_f, air.relative_humidity);
          // A dehumidifier's grain depression: the room's air less its exhaust, on the same visit.
          const roomAir = place.placementId
            ? visit.atmosphere.find((a) => a.location === "room" && a.room_id === place.roomId)
            : undefined;
          return {
            temperature_f: air.temperature_f,
            relative_humidity: air.relative_humidity,
            grains_per_pound: grains,
            dew_point_f: dewPointF(air.temperature_f, air.relative_humidity),
            grain_depression: roomAir
              ? tenth(grainsPerPound(roomAir.temperature_f, roomAir.relative_humidity) - grains)
              : null,
          };
        }),
      }));
      return {
        visits: visits.map((v) => ({ id: v.id, taken_at: v.taken_at, taken_by: v.taken_by })),
        rooms,
        atmosphere,
      };
    }),
    api.get(`${CLAIM}/drying-status`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const visits = visitsOf(claim.id);
      const states = pointsOf(claim.id).map((entry) => {
        const read = visits.flatMap((v) => {
          const value = v.readings.find((r) => r.point_id === entry.point.id)?.value;
          return value === undefined ? [] : [{ at: v.taken_at, value }];
        });
        return { entry, read, ...progress(read, entry.point.dry_standard) };
      });
      const count = (status: DryingState) => states.filter((s) => s.status === status).length;
      const lastVisit = visits.at(-1)?.taken_at ?? null;
      const alerts: Schema<"DryingAlert">[] = [];
      const drying = states.filter((s) => s.status === "drying");
      if (
        drying.length > 0 &&
        lastVisit &&
        now() - Date.parse(lastVisit) > MONITORING_INTERVAL_MS
      ) {
        const hours = Math.floor((now() - Date.parse(lastVisit)) / 3_600_000);
        alerts.push({
          kind: "monitoring_gap",
          message: `${String(drying.length)} point(s) still drying, last read ${String(hours)} hours ago`,
          point: null,
          room: null,
          equipment: null,
          since: lastVisit,
          details: { hours, drying_points: drying.length },
        });
      }
      for (const state of states) {
        const { point } = state.entry;
        const where = {
          point: { id: point.id, label: point.label },
          room: roomRef(state.entry.roomId),
          equipment: null,
        };
        if (state.status === "no_goal") {
          alerts.push({
            kind: "no_goal",
            message: `Point ${point.label} is being read but has no dry standard`,
            ...where,
            since: null,
            details: {},
          });
        } else if (state.status === "drying" && state.read.length >= STALL_READINGS) {
          const recent = state.read.slice(-STALL_READINGS);
          if (recent.every((r, i) => i === 0 || r.value >= (recent[i - 1]?.value ?? r.value))) {
            alerts.push({
              kind: "stalled",
              message: `Point ${point.label} hasn't improved over its last ${String(STALL_READINGS)} readings`,
              ...where,
              since: recent[0]?.at ?? null,
              details: {},
            });
          }
        }
      }
      // Rooms where every point has reached its goal, and since when the last one did.
      const dryRooms = new Map<string, string>();
      for (const roomOf of new Set(states.map((s) => s.entry.roomId))) {
        const inRoom = states.filter((s) => s.entry.roomId === roomOf);
        if (inRoom.every((s) => s.status === "dry" && s.driedAt)) {
          dryRooms.set(
            roomOf,
            inRoom
              .map((s) => s.driedAt ?? "")
              .sort()
              .at(-1) ?? "",
          );
        }
      }
      for (const placed of db().placements.filter(
        (p) => p.claimId === claim.id && p.removed_at === null,
      )) {
        const driedAt = dryRooms.get(placed.roomId);
        if (!driedAt) continue;
        const unit = db().equipment.find((e) => e.unit.id === placed.equipmentId)?.unit;
        alerts.push({
          kind: "equipment_in_dry_room",
          message: `${unit?.asset_tag ?? "A unit"} is still running in a room that's dry`,
          point: null,
          room: roomRef(placed.roomId),
          equipment: { placement_id: placed.id, asset_tag: unit?.asset_tag ?? "" },
          since: [driedAt, placed.placed_at].sort().at(-1) ?? null,
          details: {},
        });
      }
      return {
        summary: {
          points: states.length,
          dry: count("dry"),
          drying: count("drying"),
          no_goal: count("no_goal"),
          not_read: count("not_read"),
          all_dry: states.length > 0 && count("dry") === states.length,
          last_visit_at: lastVisit,
        },
        alerts,
      };
    }),

    // ─── Properties ──────────────────────────────────────────────────────────
    api.patch(`${ORG}/properties/{property_id}`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "claims:write");
      if (refused) return refused;
      // Properties live on claims here: every claim at this property shows the change.
      const holders = db().claims.filter(
        (c) =>
          c.organizationId === params.organization_id && c.claim.property.id === params.property_id,
      );
      const current = holders[0]?.claim.property;
      if (!current) return problem(404, "not_found");
      const changed: Schema<"PropertyRead"> = { ...current, updated_at: iso() };
      if (body.address) {
        const address = { ...body.address, country: body.address.country ?? "US" };
        const elsewhere = db().claims.find(
          (c) =>
            c.organizationId === params.organization_id &&
            c.claim.property.id !== current.id &&
            addressKey(c.claim.property.address) === addressKey(address),
        );
        if (elsewhere) {
          return problem(409, "property_exists", {
            detail: "Another property already has this address",
            property_id: elsewhere.claim.property.id,
          });
        }
        changed.address = {
          line1: address.line1.trim(),
          line2: textOrNull(address.line2),
          city: address.city.trim(),
          region: textOrNull(address.region),
          postal_code: textOrNull(address.postal_code),
          country: address.country,
          formatted: oneLine(address),
        };
      }
      if (body.property_type != null) changed.property_type = body.property_type;
      if ("year_built" in body) changed.year_built = body.year_built ?? null;
      if ("access_notes" in body) changed.access_notes = textOrNull(body.access_notes);
      if ("latitude" in body) changed.latitude = body.latitude ?? null;
      if ("longitude" in body) changed.longitude = body.longitude ?? null;
      for (const holder of holders) holder.claim = { ...holder.claim, property: changed };
      return changed;
    }),

    // ─── Price lists ─────────────────────────────────────────────────────────
    api.get(`${ORG}/price-lists`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      return db()
        .priceLists.filter((l) => l.organizationId === params.organization_id)
        .sort(
          (a, b) =>
            Number(b.list.is_default) - Number(a.list.is_default) ||
            a.list.name.localeCompare(b.list.name),
        )
        .map((l) => ({ ...l.list, item_count: l.items.length }));
    }),
    api.get(`${ORG}/price-lists/{list_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const entry = priceListOf(params.organization_id, params.list_id);
      return entry ? { ...entry.list, item_count: entry.items.length } : problem(404, "not_found");
    }),
    api.get(`${ORG}/price-lists/{list_id}/items`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const entry = priceListOf(params.organization_id, params.list_id);
      if (!entry) return problem(404, "not_found");
      const q = (query.get("q") ?? "").trim().toLowerCase();
      const category = query.get("category");
      const found = entry.items
        .filter(
          (item) =>
            (!q ||
              item.code.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q)) &&
            (!category || item.category === category),
        )
        .sort((a, b) => a.code.localeCompare(b.code));
      return paginate(found, query);
    }),

    // ─── Estimates ───────────────────────────────────────────────────────────
    api.get(`${CLAIM}/estimates`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      return db()
        .estimates.filter((e) => e.claimId === claim.id)
        .sort((a, b) => a.estimate.number - b.estimate.number)
        .map(summaryOf);
    }),
    api.get(`${CLAIM}/estimates/{estimate_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const entry = estimateOf(params.claim_id, params.estimate_id);
      return entry ? estimateNow(entry) : problem(404, "not_found");
    }),
    api.post(`${CLAIM}/estimates`, ({ request, params, body }) => {
      const ready = estimateWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const lists = db().priceLists.filter((l) => l.organizationId === params.organization_id);
      const list = body.price_list_id
        ? lists.find((l) => l.list.id === body.price_list_id)
        : lists.find((l) => l.list.is_default);
      if (body.price_list_id && !list) {
        return problem(422, "unknown_price_list", {
          detail: "No such price list",
          price_list_id: body.price_list_id,
        });
      }
      const org = db().organizations.find((o) => o.id === params.organization_id);
      const numbers = db()
        .estimates.filter((e) => e.claimId === ready.claim.id)
        .map((e) => e.estimate.number);
      const entry: EstimateEntry = {
        claimId: ready.claim.id,
        estimate: {
          id: newId(),
          claim_id: ready.claim.id,
          number: Math.max(0, ...numbers) + 1,
          title: body.title.trim(),
          status: "draft",
          notes: textOrNull(body.notes),
          price_list: list ? { id: list.list.id, name: list.list.name } : null,
          tax_percent: body.tax_percent ?? org?.default_tax_percent ?? "0",
          overhead_percent: body.overhead_percent ?? org?.default_overhead_percent ?? "0",
          profit_percent: body.profit_percent ?? org?.default_profit_percent ?? "0",
          created_by: ready.seen.person,
          created_at: iso(),
          updated_at: iso(),
        },
        lines: [],
        roomIds: [],
      };
      db().estimates.push(entry);
      record(
        ready.claim.id,
        ready.seen.person,
        "estimates",
        "estimate_created",
        `Started estimate ${String(entry.estimate.number)}, ${entry.estimate.title}`,
      );
      return estimateNow(entry);
    }),
    api.patch(`${CLAIM}/estimates/{estimate_id}`, ({ request, params, body }) => {
      const ready = estimateWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = estimateOf(ready.claim.id, params.estimate_id);
      if (!entry) return problem(404, "not_found");
      const refused = notDraft(entry);
      if (refused) return refused;
      if (body.price_list_id) {
        const list = priceListOf(params.organization_id, body.price_list_id);
        if (!list)
          return problem(422, "unknown_price_list", {
            detail: "No such price list",
            price_list_id: body.price_list_id,
          });
        entry.estimate.price_list = { id: list.list.id, name: list.list.name };
      }
      if (body.title != null) entry.estimate.title = body.title.trim();
      if ("notes" in body) entry.estimate.notes = textOrNull(body.notes);
      if (body.tax_percent != null) entry.estimate.tax_percent = body.tax_percent;
      if (body.overhead_percent != null) entry.estimate.overhead_percent = body.overhead_percent;
      if (body.profit_percent != null) entry.estimate.profit_percent = body.profit_percent;
      entry.estimate.updated_at = iso();
      return estimateNow(entry);
    }),
    api.delete(`${CLAIM}/estimates/{estimate_id}`, ({ request, params }) => {
      const ready = estimateWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = estimateOf(ready.claim.id, params.estimate_id);
      if (!entry) return problem(404, "not_found");
      const refused = notDraft(entry);
      if (refused) return refused;
      backend.db.estimates = db().estimates.filter((e) => e !== entry);
      return undefined;
    }),
    api.post(`${CLAIM}/estimates/{estimate_id}/lines`, ({ request, params, body }) => {
      const ready = estimateWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = estimateOf(ready.claim.id, params.estimate_id);
      if (!entry) return problem(404, "not_found");
      const refused = notDraft(entry);
      if (refused) return refused;
      if (body.room_id && !claimRoom(ready.claim.id, body.room_id))
        return unknownRoom(body.room_id);
      let priced: Pick<
        Schema<"LineRead">,
        "code" | "description" | "unit" | "unit_price" | "price_item_id"
      >;
      if (body.price_item_id) {
        const item = db()
          .priceLists.filter((l) => l.organizationId === params.organization_id)
          .flatMap((l) => l.items)
          .find((i) => i.id === body.price_item_id);
        if (!item) {
          return problem(422, "unknown_price_item", {
            detail: "No such price item",
            price_item_id: body.price_item_id,
          });
        }
        priced = {
          code: body.code ?? item.code,
          description: body.description ?? item.description,
          unit: body.unit ?? item.unit,
          unit_price: body.unit_price ?? item.unit_price,
          price_item_id: item.id,
        };
      } else {
        if (!body.description || !body.unit || !body.unit_price) {
          return problem(422, "validation_failed", {
            detail: "A line by hand needs a description, unit and unit price",
            errors: [
              {
                loc: ["body"],
                message: "A line by hand needs a description, unit and unit price",
                type: "value_error",
              },
            ],
          });
        }
        priced = {
          code: body.code ?? null,
          description: body.description,
          unit: body.unit,
          unit_price: body.unit_price,
          price_item_id: null,
        };
      }
      const line = {
        id: newId(),
        ...priced,
        quantity: body.quantity,
        taxable: body.taxable ?? true,
        notes: textOrNull(body.notes),
      };
      const at = Math.min(
        Math.max((body.position ?? entry.lines.length + 1) - 1, 0),
        entry.lines.length,
      );
      entry.lines.splice(at, 0, line);
      entry.roomIds.splice(at, 0, body.room_id ?? null);
      entry.estimate.updated_at = iso();
      return estimateNow(entry);
    }),
    api.patch(`${CLAIM}/estimates/{estimate_id}/lines/{line_id}`, ({ request, params, body }) => {
      const ready = estimateWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = estimateOf(ready.claim.id, params.estimate_id);
      if (!entry) return problem(404, "not_found");
      const refused = notDraft(entry);
      if (refused) return refused;
      const index = entry.lines.findIndex((l) => l.id === params.line_id);
      const line = entry.lines[index];
      if (!line) return problem(404, "not_found");
      if (body.room_id && !claimRoom(ready.claim.id, body.room_id))
        return unknownRoom(body.room_id);
      const changed = { ...line };
      for (const field of [
        "code",
        "description",
        "unit",
        "quantity",
        "unit_price",
        "taxable",
      ] as const) {
        if (body[field] != null) Object.assign(changed, { [field]: body[field] });
      }
      if ("notes" in body) changed.notes = textOrNull(body.notes);
      let roomId = entry.roomIds[index] ?? null;
      if ("room_id" in body) roomId = body.room_id ?? null;
      entry.lines.splice(index, 1);
      entry.roomIds.splice(index, 1);
      const at =
        body.position != null
          ? Math.min(Math.max(body.position - 1, 0), entry.lines.length)
          : index;
      entry.lines.splice(at, 0, changed);
      entry.roomIds.splice(at, 0, roomId);
      entry.estimate.updated_at = iso();
      return estimateNow(entry);
    }),
    api.delete(`${CLAIM}/estimates/{estimate_id}/lines/{line_id}`, ({ request, params }) => {
      const ready = estimateWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = estimateOf(ready.claim.id, params.estimate_id);
      if (!entry) return problem(404, "not_found");
      const refused = notDraft(entry);
      if (refused) return refused;
      const index = entry.lines.findIndex((l) => l.id === params.line_id);
      if (index < 0) return problem(404, "not_found");
      entry.lines.splice(index, 1);
      entry.roomIds.splice(index, 1);
      entry.estimate.updated_at = iso();
      return estimateNow(entry);
    }),
    api.post(`${CLAIM}/estimates/{estimate_id}/status`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const lockedClaim = locked(claim);
      if (lockedClaim) return lockedClaim;
      const entry = estimateOf(claim.id, params.estimate_id);
      if (!entry) return problem(404, "not_found");
      const from = entry.estimate.status;
      const allowedNext: readonly string[] = workflows.EstimateStatus.transitions[from];
      if (!allowedNext.includes(body.status)) {
        return problem(422, "estimate_transition", {
          detail: `A ${from} estimate can't become ${body.status}`,
          allowed: [...allowedNext],
        });
      }
      // Approving, rejecting and reopening an approved one take the right to approve.
      const needs =
        body.status === "approved" || body.status === "rejected" || from === "approved"
          ? "estimates:approve"
          : "estimates:write";
      const refused = allowed(seen.membership, needs);
      if (refused) return refused;
      if (body.status === "submitted" && entry.lines.length === 0) {
        return problem(422, "estimate_transition", {
          detail: "An estimate needs at least one line to be submitted",
          allowed: [...allowedNext],
        });
      }
      entry.estimate.status = body.status;
      entry.estimate.updated_at = iso();
      record(
        claim.id,
        seen.person,
        "estimates",
        "estimate_status_changed",
        `Estimate ${String(entry.estimate.number)} ${body.status === "draft" ? "back to draft" : body.status}`,
      );
      return estimateNow(entry);
    }),

    // ─── Equipment ───────────────────────────────────────────────────────────
    api.get(`${ORG}/equipment`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const kind = query.get("kind");
      const status = query.get("status");
      const q = (query.get("q") ?? "").trim().toLowerCase();
      const available = query.get("available");
      const found = db()
        .equipment.filter((e) => e.organizationId === params.organization_id)
        .map(unitNow)
        .filter(
          (u) =>
            (!kind || u.kind === kind) &&
            (!status || u.status === status) &&
            (!q ||
              [u.asset_tag, u.name, u.serial_number].some((t) => t?.toLowerCase().includes(q))) &&
            (available === null ||
              (available === "true") ===
                (u.status === "in_service" && u.current_placement === null)),
        )
        .sort((a, b) => a.asset_tag.localeCompare(b.asset_tag, undefined, { numeric: true }));
      return paginate(found, query);
    }),
    api.get(`${ORG}/equipment/{equipment_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const entry = unitOf(params.organization_id, params.equipment_id);
      return entry ? unitNow(entry) : problem(404, "not_found");
    }),
    api.post(`${ORG}/equipment`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "field_data:write");
      if (refused) return refused;
      const tag = body.asset_tag.trim();
      const taken = db().equipment.some(
        (e) =>
          e.organizationId === params.organization_id &&
          e.unit.asset_tag.toLowerCase() === tag.toLowerCase(),
      );
      if (taken)
        return problem(409, "asset_tag_taken", { detail: `${tag} is already in the fleet` });
      const entry = {
        organizationId: params.organization_id,
        unit: {
          id: newId(),
          kind: body.kind,
          name: body.name.trim(),
          asset_tag: tag,
          serial_number: textOrNull(body.serial_number),
          capacity: CAPACITY_UNITS[body.kind] ? (body.capacity ?? null) : null,
          capacity_unit: body.capacity ? (CAPACITY_UNITS[body.kind] ?? null) : null,
          status: body.status ?? "in_service",
          notes: textOrNull(body.notes),
          created_at: iso(),
          updated_at: iso(),
        },
      };
      db().equipment.push(entry);
      return unitNow(entry);
    }),
    api.patch(`${ORG}/equipment/{equipment_id}`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "field_data:write");
      if (refused) return refused;
      const entry = unitOf(params.organization_id, params.equipment_id);
      if (!entry) return problem(404, "not_found");
      if (body.asset_tag != null) {
        const tag = body.asset_tag.trim();
        const taken = db().equipment.some(
          (e) =>
            e !== entry &&
            e.organizationId === params.organization_id &&
            e.unit.asset_tag.toLowerCase() === tag.toLowerCase(),
        );
        if (taken)
          return problem(409, "asset_tag_taken", { detail: `${tag} is already in the fleet` });
        entry.unit.asset_tag = tag;
      }
      if (body.name != null) entry.unit.name = body.name.trim();
      if (body.kind != null) entry.unit.kind = body.kind;
      if (body.status != null) entry.unit.status = body.status;
      if ("serial_number" in body) entry.unit.serial_number = textOrNull(body.serial_number);
      if ("notes" in body) entry.unit.notes = textOrNull(body.notes);
      if ("capacity" in body) entry.unit.capacity = body.capacity ?? null;
      entry.unit.capacity_unit =
        entry.unit.capacity === null ? null : (CAPACITY_UNITS[entry.unit.kind] ?? null);
      if (entry.unit.capacity_unit === null) entry.unit.capacity = null;
      entry.unit.updated_at = iso();
      return unitNow(entry);
    }),
    api.delete(`${ORG}/equipment/{equipment_id}`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const refused = allowed(seen.membership, "field_data:write");
      if (refused) return refused;
      const entry = unitOf(params.organization_id, params.equipment_id);
      if (!entry) return problem(404, "not_found");
      if (db().placements.some((p) => p.equipmentId === entry.unit.id)) {
        return problem(409, "equipment_has_history", {
          detail: `${entry.unit.asset_tag} has been placed on jobs; set its status to retired instead`,
        });
      }
      backend.db.equipment = db().equipment.filter((e) => e !== entry);
      return undefined;
    }),
    api.get(`${CLAIM}/equipment-placements`, ({ request, params, query }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const running = query.get("running");
      const roomId = query.get("room_id");
      return db()
        .placements.filter(
          (p) =>
            p.claimId === claim.id &&
            (running === null || (running === "true") === (p.removed_at === null)) &&
            (!roomId || p.roomId === roomId),
        )
        .sort((a, b) => a.placed_at.localeCompare(b.placed_at) || a.id.localeCompare(b.id))
        .map(placementNow);
    }),
    api.get(`${CLAIM}/equipment-days`, ({ request, params }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      const byKind = new Map<Schema<"EquipmentKind">, Schema<"EquipmentDays">>();
      for (const p of db()
        .placements.filter((x) => x.claimId === claim.id)
        .map(placementNow)) {
        const row = byKind.get(p.equipment.kind) ?? {
          kind: p.equipment.kind,
          placements: 0,
          running: 0,
          days: 0,
        };
        row.placements += 1;
        row.running += p.running ? 1 : 0;
        row.days += p.days;
        byKind.set(p.equipment.kind, row);
      }
      return [...byKind.values()];
    }),
    api.post(`${CLAIM}/equipment-placements`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const entry = unitOf(params.organization_id, body.equipment_id);
      if (!entry) return problem(404, "not_found", { detail: "No such unit in the fleet" });
      if (!claimRoom(ready.claim.id, body.room_id)) return unknownRoom(body.room_id);
      if (entry.unit.status !== "in_service") {
        return problem(422, "equipment_unavailable", {
          detail: `${entry.unit.asset_tag} is ${entry.unit.status.replace("_", " ")}`,
          equipment_status: entry.unit.status,
        });
      }
      const busy = runningElsewhere(entry.unit.id);
      if (busy) return busy;
      const placedAt = body.placed_at ?? iso();
      if (inFuture(placedAt)) return futureTime();
      const placed: Placement = {
        claimId: ready.claim.id,
        id: newId(),
        equipmentId: entry.unit.id,
        roomId: body.room_id,
        placed_at: new Date(placedAt).toISOString(),
        removed_at: null,
        placed_by: ready.seen.person,
        removed_by: null,
      };
      db().placements.push(placed);
      record(
        ready.claim.id,
        ready.seen.person,
        "equipment",
        "equipment_placed",
        `Placed ${entry.unit.asset_tag} in the ${roomRef(body.room_id)?.name ?? "room"}`,
      );
      return placementNow(placed);
    }),
    api.patch(`${CLAIM}/equipment-placements/{placement_id}`, ({ request, params, body }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const placed = db().placements.find(
        (p) => p.claimId === ready.claim.id && p.id === params.placement_id,
      );
      if (!placed) return problem(404, "not_found");
      if (body.room_id) {
        if (!claimRoom(ready.claim.id, body.room_id)) return unknownRoom(body.room_id);
        placed.roomId = body.room_id;
      }
      const placedAt = body.placed_at ?? placed.placed_at;
      const removedAt = "removed_at" in body ? (body.removed_at ?? null) : placed.removed_at;
      if (inFuture(placedAt) || (removedAt && inFuture(removedAt))) return futureTime();
      if (removedAt && Date.parse(removedAt) < Date.parse(placedAt)) {
        return problem(422, "removed_before_placed", {
          detail: "A unit can't be removed before it was placed",
        });
      }
      if (removedAt === null && placed.removed_at !== null) {
        // Back to running: only if it isn't running elsewhere.
        const busy = runningElsewhere(placed.equipmentId, placed.id);
        if (busy) return busy;
        placed.removed_by = null;
      }
      placed.placed_at = new Date(placedAt).toISOString();
      placed.removed_at = removedAt && new Date(removedAt).toISOString();
      return placementNow(placed);
    }),
    api.post(`${CLAIM}/equipment-placements/{placement_id}/remove`, ({ request, params, body }) => {
      const seen = member(request, params.organization_id);
      if (seen instanceof Response) return seen;
      const claim = claimOr404(params.organization_id, params.claim_id);
      if (claim instanceof Response) return claim;
      // Works on closed claims too: a unit is never stranded on a finished job.
      const refused = allowed(seen.membership, "field_data:write");
      if (refused) return refused;
      const placed = db().placements.find(
        (p) => p.claimId === claim.id && p.id === params.placement_id,
      );
      if (!placed) return problem(404, "not_found");
      if (placed.removed_at !== null) {
        return problem(409, "already_removed", {
          detail: "That unit was already removed",
          removed_at: placed.removed_at,
        });
      }
      const removedAt = body.removed_at ?? iso();
      if (inFuture(removedAt)) return futureTime();
      if (Date.parse(removedAt) < Date.parse(placed.placed_at)) {
        return problem(422, "removed_before_placed", {
          detail: "A unit can't be removed before it was placed",
        });
      }
      placed.removed_at = new Date(removedAt).toISOString();
      placed.removed_by = seen.person;
      const tag =
        db().equipment.find((e) => e.unit.id === placed.equipmentId)?.unit.asset_tag ?? "A unit";
      record(claim.id, seen.person, "equipment", "equipment_removed", `Removed ${tag}`);
      return placementNow(placed);
    }),
    api.delete(`${CLAIM}/equipment-placements/{placement_id}`, ({ request, params }) => {
      const ready = fieldWork(request, params.organization_id, params.claim_id);
      if (ready instanceof Response) return ready;
      const placed = db().placements.find(
        (p) => p.claimId === ready.claim.id && p.id === params.placement_id,
      );
      if (!placed) return problem(404, "not_found");
      backend.db.placements = db().placements.filter((p) => p !== placed);
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
