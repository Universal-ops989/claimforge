import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import { CONTRACT_PATH } from "../../scripts/generate.mjs";
import type { SchemaName } from "../index";
import { schemas } from "../zod.gen";
import {
  claim,
  claimSummary,
  document,
  dryingStatus,
  estimate,
  estimateLine,
  estimateSummary,
  fixtureId,
  ids,
  invitation,
  me,
  memberRead,
  moistureLog,
  moisturePoint,
  note,
  organization,
  page,
  photo,
  report,
  room,
  share,
  statusChange,
  structure,
  task,
  timelineEntry,
  tokenPair,
} from "./index";

type JsonSchema = Record<string, unknown> & {
  $ref?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
};

const contract = JSON.parse(await readFile(CONTRACT_PATH, "utf8")) as {
  components: { schemas: Record<string, JsonSchema> };
};

/**
 * Keys in `value` the contract doesn't have, anywhere in it. Zod's object schemas let
 * extra keys through, so parsing alone wouldn't catch a fixture that kept a renamed field.
 */
function unknownKeys(value: unknown, schema: JsonSchema, at: string): string[] {
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() ?? "";
    return unknownKeys(value, contract.components.schemas[name] ?? {}, at);
  }
  if (schema.anyOf) {
    // The branch that fits best: the one with the fewest unknown keys.
    const found = schema.anyOf.map((branch) => unknownKeys(value, branch, at));
    return found.reduce((best, keys) => (keys.length < best.length ? keys : best));
  }
  if (Array.isArray(value)) {
    return schema.items
      ? value.flatMap((item, i) => unknownKeys(item, schema.items ?? {}, `${at}[${String(i)}]`))
      : [];
  }
  if (value === null || typeof value !== "object" || !schema.properties) {
    return [];
  }
  return Object.entries(value).flatMap(([key, field]) => {
    const property = schema.properties?.[key];
    return property ? unknownKeys(field, property, `${at}.${key}`) : [`${at}.${key}`];
  });
}

const FIXTURES: [string, SchemaName, unknown][] = [
  ["me()", "MeResponse", me()],
  ["tokenPair()", "TokenResponse", tokenPair()],
  ["organization()", "OrganizationRead", organization()],
  ["invitation()", "InvitationRead", invitation()],
  ["memberRead()", "MemberRead", memberRead()],
  ["claim()", "ClaimRead", claim()],
  ["claimSummary()", "ClaimSummary", claimSummary()],
  ["statusChange()", "ClaimStatusChangeRead", statusChange()],
  ["timelineEntry()", "TimelineEntry", timelineEntry()],
  ["room()", "RoomRead", room()],
  ["structure()", "StructureRead", structure()],
  ["task()", "TaskRead", task()],
  ["task({ done: true })", "TaskRead", task({ done: true })],
  ["note()", "NoteRead", note()],
  ["photo()", "PhotoRead", photo()],
  ["document()", "DocumentRead", document()],
  ["moisturePoint()", "MoisturePointRead", moisturePoint()],
  ["moistureLog()", "MoistureLogRead", moistureLog()],
  ["dryingStatus()", "DryingStatusRead", dryingStatus()],
  ["estimateLine()", "LineRead", estimateLine()],
  ["estimate()", "EstimateRead", estimate()],
  ["estimate({ status: 'submitted' })", "EstimateRead", estimate({ status: "submitted" })],
  ["estimateSummary()", "EstimateSummary", estimateSummary()],
  ["report()", "ReportJobRead", report()],
  ["report({ status: 'queued' })", "ReportJobRead", report({ status: "queued" })],
  ["report({ status: 'failed' })", "ReportJobRead", report({ status: "failed" })],
  ["share()", "ShareRead", share()],
];

describe("every fixture", () => {
  test.each(FIXTURES)("%s is a valid %s", (_, name, fixture) => {
    const parsed = schemas[name].safeParse(fixture);

    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(unknownKeys(fixture, { $ref: `#/components/schemas/${name}` }, name)).toEqual([]);
  });

  test("the key check notices a field the contract doesn't have", () => {
    const stale = { ...claim(), assignee: null, property: { ...claim().property, zip: "78701" } };

    expect(unknownKeys(stale, { $ref: "#/components/schemas/ClaimRead" }, "claim")).toEqual([
      "claim.property.zip",
      "claim.assignee",
    ]);
  });

  test("pages are valid lists", () => {
    const list = schemas.CursorPage_ClaimSummary_.safeParse(page([claimSummary()], "c1"));

    expect(list.success).toBe(true);
    expect(page([]).has_more).toBe(false);
    expect(page([], "c1")).toMatchObject({ next_cursor: "c1", has_more: true });
  });
});

describe("the data hangs together", () => {
  test("ids are UUIDs, fixed, and sort by number within a kind", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    expect(Object.values(ids).every((id) => uuid.test(id))).toBe(true);
    expect(new Set(Object.values(ids)).size).toBe(Object.values(ids).length);
    expect(fixtureId("claim", 2) < fixtureId("claim", 10)).toBe(true);
    expect(fixtureId("claim", 2)).toBe(fixtureId("claim", 2));
  });

  test("things point at each other", () => {
    expect(task().claim).toEqual({ id: claim().id, number: claim().number });
    expect(room().structure_id).toBe(structure().id);
    expect(structure().rooms).toEqual([room()]);
    expect(moistureLog().readings[0]?.point_id).toBe(moisturePoint().id);
    expect(share().report_id).toBe(report().id);
    expect(claimSummary().number).toBe(claim().number);
    expect(estimateSummary().total).toBe(estimate().total);
  });

  test("overrides replace fields, and derived fields follow", () => {
    expect(claim({ status: "inspected" }).status).toBe("inspected");
    expect(claim({ status: "completed" }).next_statuses).toEqual(["in_progress", "closed"]);
    expect(estimate({ status: "approved" }).next_statuses).toEqual(["draft"]);
    expect(task({ done: true }).completed_at).not.toBeNull();
    expect(report({ status: "queued" }).download_url).toBeNull();
    expect(photo({ id: fixtureId("photo", 2) }).url).toContain(fixtureId("photo", 2));
  });

  test("an estimate's totals add up as the API adds them", () => {
    const priced = estimate({
      tax_percent: "8.25",
      overhead_percent: "10",
      profit_percent: "10",
      lines: [
        estimateLine(), // 3 days at 85.00, kitchen
        estimateLine({
          id: fixtureId("line", 2),
          position: 2,
          quantity: "2",
          unit_price: "40.00",
          taxable: true,
          room: null,
        }),
      ],
    });

    expect(priced.totals).toEqual({
      subtotal: "335.00",
      taxable_subtotal: "80.00",
      tax: "6.60",
      overhead: "33.50",
      profit: "33.50",
      total: "408.60",
    });
    expect(priced.total).toBe("408.60");
    expect(priced.rooms).toEqual([
      { room: { id: ids.room, name: "Kitchen" }, lines: 1, subtotal: "255.00" },
      { room: null, lines: 1, subtotal: "80.00" },
    ]);
    expect(schemas.EstimateRead.safeParse(priced).success).toBe(true);
  });
});
