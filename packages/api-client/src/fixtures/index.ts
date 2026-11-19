/**
 * What the API sends, as factories: `@claimforge/api-client/fixtures`.
 *
 *     claim({ status: "inspected" })
 *     task({ title: "Set dryers", done: true })
 *     page([claimSummary(), claimSummary({ number: "2026-00043" })])
 *
 * Each factory returns a contract-valid object (a test parses every one with its Zod
 * schema), and overrides replace top-level fields. Ids are fixed and the data hangs
 * together: a task's `claim` is the claim fixture, a room's `structure_id` the structure
 * fixture, an estimate's totals add up. For a second claim, room or task, pass another
 * `id` (`fixtureId("claim", 2)`).
 */
import type { CursorPage, Schema, SchemaName } from "../index";
import { workflows } from "../zod.gen";

/** Top-level fields to replace. */
type Overrides<Name extends SchemaName> = Partial<Schema<Name>>;

// ─── Ids and people ──────────────────────────────────────────────────────────

const KINDS = {
  organization: "0a",
  person: "0b",
  claim: "0d",
  property: "0e",
  contact: "0c",
  structure: "11",
  room: "12",
  task: "13",
  note: "14",
  photo: "15",
  document: "16",
  point: "17",
  log: "18",
  estimate: "19",
  line: "1a",
  report: "1b",
  share: "1c",
  invitation: "1d",
  timeline: "1e",
  statusChange: "1f",
} as const;

/** A fixed UUIDv7-shaped id per kind and number; ids of one kind sort by `n`. */
export function fixtureId(kind: keyof typeof KINDS, n = 1): string {
  return `0198a2c4-7b1e-7cc0-8000-0000${KINDS[kind]}${n.toString(16).padStart(6, "0")}`;
}

export const ids = {
  organization: fixtureId("organization"),
  claim: fixtureId("claim"),
  property: fixtureId("property"),
  structure: fixtureId("structure"),
  room: fixtureId("room"),
  task: fixtureId("task"),
  note: fixtureId("note"),
  photo: fixtureId("photo"),
  document: fixtureId("document"),
  point: fixtureId("point"),
  log: fixtureId("log"),
  estimate: fixtureId("estimate"),
  line: fixtureId("line"),
  report: fixtureId("report"),
  share: fixtureId("share"),
  invitation: fixtureId("invitation"),
} as const;

export const CLAIM_NUMBER = "2026-00042";

/** The signed-in user (an owner) and a technician. */
export const people = {
  morgan: { id: fixtureId("person", 1), full_name: "Morgan Member" },
  riley: { id: fixtureId("person", 2), full_name: "Riley Tech" },
} as const satisfies Record<string, Schema<"ClaimActor">>;

const CREATED = "2026-11-10T15:00:00Z";
const TODAY = "2026-11-16T12:00:00Z";
const claimRef = { id: ids.claim, number: CLAIM_NUMBER };
const kitchen = { id: ids.room, name: "Kitchen" };

/** A page of a cursor-paginated list; `next` makes it not the last. */
export function page<Item>(items: Item[], next: string | null = null): CursorPage<Item> {
  return { items, next_cursor: next, has_more: next !== null };
}

// ─── Session and organizations ───────────────────────────────────────────────

type Permission = Schema<"Permission">;
const VIEWER: Permission[] = ["org:read", "members:read", "claims:read", "contacts:read"];
const TECHNICIAN: Permission[] = [...VIEWER, "field_data:write"];
const ADJUSTER: Permission[] = [
  ...TECHNICIAN,
  "claims:write",
  "contacts:write",
  "estimates:write",
  "estimates:approve",
  "reports:generate",
];
const ADMIN: Permission[] = [
  ...ADJUSTER,
  "org:update",
  "members:manage",
  "claims:delete",
  "claims:reopen",
  "audit:read",
];

/** What each role may do, as the API grants it (`auth/permissions.py`). */
export const rolePermissions: Record<Schema<"Role">, Permission[]> = {
  viewer: VIEWER,
  technician: TECHNICIAN,
  adjuster: ADJUSTER,
  admin: ADMIN,
  owner: [...ADMIN, "org:delete"],
};

export function me(changes: Overrides<"MeResponse"> = {}): Schema<"MeResponse"> {
  return {
    id: people.morgan.id,
    email: "morgan@example.com",
    full_name: people.morgan.full_name,
    memberships: [
      {
        organization: { id: ids.organization, name: "Lone Star Restoration", slug: "lone-star" },
        role: "owner",
        permissions: rolePermissions.owner,
      },
    ],
    ...changes,
  };
}

/** Tokens as `/v1/auth/login` and `/v1/auth/refresh` answer; `n` tells pairs apart. */
export function tokenPair(n = 1): Schema<"TokenResponse"> {
  return {
    access_token: `access-${String(n)}`,
    token_type: "bearer",
    expires_in: 900,
    refresh_token: `refresh-${String(n)}`,
    refresh_expires_at: "2026-12-16T12:00:00Z",
  };
}

export function organization(
  changes: Overrides<"OrganizationRead"> = {},
): Schema<"OrganizationRead"> {
  return {
    id: ids.organization,
    name: "Lone Star Restoration",
    slug: "lone-star",
    timezone: "America/Chicago",
    default_tax_percent: "8.25",
    default_overhead_percent: "10",
    default_profit_percent: "10",
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
    ...changes,
  };
}

/** A member as `GET /organizations/{id}/members` lists them: Riley, a technician. */
export function memberRead(changes: Overrides<"MemberRead"> = {}): Schema<"MemberRead"> {
  return {
    user: people.riley,
    role: "technician",
    permissions: [...rolePermissions.technician].sort(),
    joined_at: CREATED,
    ...changes,
  };
}

export function invitation(changes: Overrides<"InvitationRead"> = {}): Schema<"InvitationRead"> {
  return {
    id: ids.invitation,
    email: "jordan@example.com",
    role: "technician",
    created_at: TODAY,
    expires_at: "2026-11-23T12:00:00Z",
    ...changes,
  };
}

// ─── Claims ──────────────────────────────────────────────────────────────────

/** A new water claim on a house in Austin; `next_statuses` follow `status`. */
export function claim(changes: Overrides<"ClaimRead"> = {}): Schema<"ClaimRead"> {
  const status = changes.status ?? "new";
  return {
    id: ids.claim,
    number: CLAIM_NUMBER,
    status,
    next_statuses: [...workflows.ClaimStatus.transitions[status]],
    loss_type: "water",
    loss_date: "2026-11-10",
    description: "Supply line burst under the kitchen sink",
    policy_number: null,
    carrier_name: null,
    carrier_claim_number: null,
    property: {
      id: ids.property,
      address: {
        line1: "100 Congress Ave",
        line2: null,
        city: "Austin",
        region: "TX",
        postal_code: "78701",
        country: "US",
        formatted: "100 Congress Ave, Austin, TX 78701",
      },
      property_type: "residential",
      year_built: 1998,
      latitude: null,
      longitude: null,
      access_notes: null,
      created_at: CREATED,
      updated_at: CREATED,
    },
    contacts: [],
    assignments: [],
    created_by_id: people.morgan.id,
    created_at: CREATED,
    updated_at: CREATED,
    ...changes,
  };
}

/** The claim as lists show it; `changes` apply to the summary. */
export function claimSummary(changes: Overrides<"ClaimSummary"> = {}): Schema<"ClaimSummary"> {
  const full = claim();
  return {
    id: full.id,
    number: full.number,
    status: full.status,
    loss_type: full.loss_type,
    loss_date: full.loss_date,
    policy_number: full.policy_number,
    carrier_name: full.carrier_name,
    carrier_claim_number: full.carrier_claim_number,
    property: full.property,
    primary_contact: null,
    adjuster: null,
    created_at: full.created_at,
    updated_at: full.updated_at,
    ...changes,
  };
}

export function statusChange(
  changes: Overrides<"ClaimStatusChangeRead"> = {},
): Schema<"ClaimStatusChangeRead"> {
  return {
    id: fixtureId("statusChange"),
    from_status: "new",
    to_status: "inspected",
    reason: null,
    changed_by: people.morgan,
    changed_at: TODAY,
    ...changes,
  };
}

export function timelineEntry(changes: Overrides<"TimelineEntry"> = {}): Schema<"TimelineEntry"> {
  return {
    id: fixtureId("timeline"),
    at: TODAY,
    kind: "status",
    action: "status_changed",
    actor: people.morgan,
    subject: { type: "claim", id: ids.claim },
    summary: "Moved the claim from new to inspected",
    changes: {},
    ...changes,
  };
}

// ─── Layout ──────────────────────────────────────────────────────────────────

/** The kitchen: 12 × 10 ft, 8 ft ceiling, in the house. */
export function room(changes: Overrides<"RoomRead"> = {}): Schema<"RoomRead"> {
  return {
    id: ids.room,
    structure_id: ids.structure,
    name: "Kitchen",
    level: "1",
    length_ft: 12,
    width_ft: 10,
    height_ft: 8,
    floor_area_sqft: 120,
    wall_area_sqft: 352,
    volume_cuft: 960,
    created_at: CREATED,
    updated_at: CREATED,
    ...changes,
  };
}

/** The house, with the kitchen in it. */
export function structure(changes: Overrides<"StructureRead"> = {}): Schema<"StructureRead"> {
  return {
    id: ids.structure,
    name: "House",
    rooms: [room()],
    created_at: CREATED,
    updated_at: CREATED,
    ...changes,
  };
}

// ─── Tasks and notes ─────────────────────────────────────────────────────────

export function task(changes: Overrides<"TaskRead"> = {}): Schema<"TaskRead"> {
  const done = changes.done ?? false;
  return {
    id: ids.task,
    claim: claimRef,
    title: "Set dryers in the kitchen",
    description: null,
    due_on: "2026-11-18",
    done,
    completed_at: done ? TODAY : null,
    completed_by_id: done ? people.riley.id : null,
    assignee: people.riley,
    created_by_id: people.morgan.id,
    created_at: TODAY,
    updated_at: TODAY,
    ...changes,
  };
}

/** A note by Riley mentioning Morgan; `body` and `text` agree. */
export function note(changes: Overrides<"NoteRead"> = {}): Schema<"NoteRead"> {
  return {
    id: ids.note,
    claim: claimRef,
    author: people.riley,
    body: `Dryers set, <@${people.morgan.id}> to check tomorrow`,
    text: "Dryers set, @Morgan Member to check tomorrow",
    mentions: [people.morgan],
    edited_at: null,
    created_at: TODAY,
    updated_at: TODAY,
    ...changes,
  };
}

// ─── Media ───────────────────────────────────────────────────────────────────

/** A processed photo in the kitchen. */
export function photo(changes: Overrides<"PhotoRead"> = {}): Schema<"PhotoRead"> {
  const id = changes.id ?? ids.photo;
  return {
    id,
    claim_id: ids.claim,
    filename: "IMG_0412.jpg",
    content_type: "image/jpeg",
    size_bytes: 2_048_000,
    caption: "Stain spreading from the vent",
    tags: ["before", "ceiling"],
    room: kitchen,
    taken_at: "2026-11-16T11:30:00Z",
    processing: "ready",
    width: 4032,
    height: 3024,
    url: `https://storage.test/photos/${id}.jpg`,
    download_url: `https://storage.test/photos/${id}.jpg?download=1`,
    preview_url: `https://storage.test/photos/${id}/preview.jpg`,
    thumbnail_url: `https://storage.test/photos/${id}/thumb.jpg`,
    uploaded_by: people.riley,
    created_at: TODAY,
    ...changes,
  };
}

export function document(changes: Overrides<"DocumentRead"> = {}): Schema<"DocumentRead"> {
  const id = changes.id ?? ids.document;
  return {
    id,
    claim_id: ids.claim,
    title: "Signed work authorization",
    filename: "WA-1042 signed.pdf",
    category: "authorization",
    content_type: "application/pdf",
    size_bytes: 184_000,
    view_url: `https://storage.test/documents/${id}.pdf`,
    download_url: `https://storage.test/documents/${id}.pdf?download=1`,
    uploaded_by: people.morgan,
    created_at: TODAY,
    updated_at: TODAY,
    ...changes,
  };
}

// ─── Moisture ────────────────────────────────────────────────────────────────

/** Point 1: drywall on a kitchen wall, dry at 12%. */
export function moisturePoint(
  changes: Overrides<"MoisturePointRead"> = {},
): Schema<"MoisturePointRead"> {
  return {
    id: ids.point,
    label: "1",
    room: kitchen,
    surface: "wall",
    material: "drywall",
    scale: "percent",
    dry_standard: 12,
    dry_standard_basis: "reference",
    notes: null,
    created_at: CREATED,
    updated_at: CREATED,
    ...changes,
  };
}

/** A visit that read point 1 at 18% and the kitchen air. */
export function moistureLog(changes: Overrides<"MoistureLogRead"> = {}): Schema<"MoistureLogRead"> {
  return {
    id: ids.log,
    taken_at: "2026-11-16T15:00:00Z",
    taken_by: people.riley,
    notes: null,
    readings: [{ point_id: ids.point, label: "1", value: 18 }],
    atmosphere: [
      {
        location: "room",
        room: kitchen,
        dehumidifier: null,
        temperature_f: 72,
        relative_humidity: 55,
        grains_per_pound: 64.8,
        dew_point_f: 55.2,
      },
    ],
    readings_edited_at: null,
    created_at: "2026-11-16T15:05:00Z",
    updated_at: "2026-11-16T15:05:00Z",
    ...changes,
  };
}

/** One point, still drying. */
export function dryingStatus(
  changes: Overrides<"DryingStatusRead"> = {},
): Schema<"DryingStatusRead"> {
  return {
    summary: {
      points: 1,
      dry: 0,
      drying: 1,
      no_goal: 0,
      not_read: 0,
      all_dry: false,
      last_visit_at: "2026-11-16T15:00:00Z",
    },
    alerts: [],
    ...changes,
  };
}

// ─── Estimates ───────────────────────────────────────────────────────────────

/** Dollars "12.50" to cents, and back. */
const cents = (dollars: string) => Math.round(Number(dollars) * 100);
const dollars = (amount: number) => (amount / 100).toFixed(2);

export function estimateLine(changes: Overrides<"LineRead"> = {}): Schema<"LineRead"> {
  const quantity = changes.quantity ?? "3";
  const unit_price = changes.unit_price ?? "85.00";
  return {
    id: ids.line,
    position: 1,
    code: "WTR-DEHU",
    description: "Dehumidifier, per day",
    quantity,
    unit: "DA",
    unit_price,
    total: dollars(Math.round(Number(quantity) * cents(unit_price))),
    taxable: false,
    notes: null,
    room: kitchen,
    price_item_id: null,
    ...changes,
  };
}

/**
 * A draft estimate whose totals are worked out from its lines and rates, as the API does:
 * tax on taxable lines, overhead and profit on the subtotal.
 */
export function estimate(changes: Overrides<"EstimateRead"> = {}): Schema<"EstimateRead"> {
  const lines = changes.lines ?? [estimateLine()];
  const rate = (percent: string) => Number(percent) / 100;
  const tax_percent = changes.tax_percent ?? "0";
  const overhead_percent = changes.overhead_percent ?? "0";
  const profit_percent = changes.profit_percent ?? "0";
  const subtotal = lines.reduce((sum, line) => sum + cents(line.total), 0);
  const taxable = lines.filter((line) => line.taxable).reduce((s, l) => s + cents(l.total), 0);
  const tax = Math.round(taxable * rate(tax_percent));
  const overhead = Math.round(subtotal * rate(overhead_percent));
  const profit = Math.round(subtotal * rate(profit_percent));
  const total = subtotal + tax + overhead + profit;
  const byRoom = new Map<
    string | null,
    { room: Schema<"LineRoom"> | null; lines: number; cents: number }
  >();
  for (const line of lines) {
    const key = line.room?.id ?? null;
    const entry = byRoom.get(key) ?? { room: line.room, lines: 0, cents: 0 };
    byRoom.set(key, { ...entry, lines: entry.lines + 1, cents: entry.cents + cents(line.total) });
  }
  const status = changes.status ?? "draft";
  return {
    id: ids.estimate,
    claim_id: ids.claim,
    number: 1,
    title: "Mitigation",
    status,
    next_statuses: [...workflows.EstimateStatus.transitions[status]],
    notes: null,
    price_list: null,
    tax_percent,
    overhead_percent,
    profit_percent,
    lines,
    rooms: [...byRoom.values()].map((entry) => ({
      room: entry.room,
      lines: entry.lines,
      subtotal: dollars(entry.cents),
    })),
    totals: {
      subtotal: dollars(subtotal),
      taxable_subtotal: dollars(taxable),
      tax: dollars(tax),
      overhead: dollars(overhead),
      profit: dollars(profit),
      total: dollars(total),
    },
    total: dollars(total),
    created_by: people.morgan,
    created_at: TODAY,
    updated_at: TODAY,
    ...changes,
  };
}

/** The estimate as the claim's list shows it. */
export function estimateSummary(
  changes: Overrides<"EstimateSummary"> = {},
): Schema<"EstimateSummary"> {
  const { id, claim_id, number, title, status, total, created_at, updated_at } = estimate();
  return { id, claim_id, number, title, status, total, created_at, updated_at, ...changes };
}

// ─── Reports ─────────────────────────────────────────────────────────────────

/** A ready photo report; pass `status: "queued"` for one still being made. */
export function report(changes: Overrides<"ReportJobRead"> = {}): Schema<"ReportJobRead"> {
  const id = changes.id ?? ids.report;
  const status = changes.status ?? "ready";
  return {
    id,
    claim_id: ids.claim,
    kind: "photo_report",
    status,
    download_url: status === "ready" ? `https://storage.test/reports/${id}.pdf?sig=abc` : null,
    size_bytes: status === "ready" ? 1_240_000 : null,
    error: status === "failed" ? "No photos to report" : null,
    requested_by: people.morgan,
    created_at: TODAY,
    finished_at: status === "queued" ? null : "2026-11-16T12:00:08Z",
    ...changes,
  };
}

/** An active share of the report, as listed (no URL: that's only in the create answer). */
export function share(changes: Overrides<"ShareRead"> = {}): Schema<"ShareRead"> {
  return {
    id: ids.share,
    report_id: ids.report,
    label: "For the adjuster",
    active: true,
    expires_at: "2026-11-23T12:00:00Z",
    revoked_at: null,
    open_count: 0,
    last_opened_at: null,
    created_by: people.morgan,
    created_at: TODAY,
    ...changes,
  };
}
