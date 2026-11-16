// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  allItems,
  queryKeys,
  useCreateMoistureLog,
  useDeleteMoistureLog,
  useDeleteMoisturePoint,
  useDryingLog,
  useDryingStatus,
  useMoistureLogs,
  useMoisturePoints,
  useUpdateMoisturePoint,
  useUpdateRoom,
} from "./index";
import { CLAIM_ID, FakeServer, json, MORGAN, noContent, ORG_ID, renderWithApi } from "./testing";

afterEach(cleanup);

const CLAIM = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}`;
const KITCHEN = { id: "0198a2c4-7b1e-7cc0-8000-000000000201", name: "Kitchen" };

function point(n: number, changes: Partial<Schema<"MoisturePointRead">> = {}) {
  return {
    id: `0198a2c4-7b1e-7cc0-8000-00000000070${String(n)}`,
    label: String(n),
    room: KITCHEN,
    surface: "wall",
    material: "drywall",
    scale: "percent",
    dry_standard: 12,
    dry_standard_basis: "reference",
    notes: null,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
    ...changes,
  } satisfies Schema<"MoisturePointRead">;
}

function visit(n: number): Schema<"MoistureLogRead"> {
  return {
    id: `0198a2c4-7b1e-7cc0-8000-00000000080${String(n)}`,
    taken_at: `2026-11-1${String(n)}T15:00:00Z`,
    taken_by: MORGAN,
    notes: null,
    readings: [],
    atmosphere: [],
    readings_edited_at: null,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
  };
}

const status = (drying: number): Schema<"DryingStatusRead"> => ({
  summary: {
    points: 1,
    dry: 1 - drying,
    drying,
    no_goal: 0,
    not_read: 0,
    all_dry: drying === 0,
    last_visit_at: "2026-11-16T15:00:00Z",
  },
  alerts: [],
});

const page = <Item,>(items: Item[]) => ({ items, next_cursor: null, has_more: false });

/** Points 1 and 2, visits 1 and 2, the drying views; counts GETs by path. */
function dryingServer() {
  const server = new FakeServer()
    .on("GET", `${CLAIM}/moisture-points`, () => json([point(1), point(2)]))
    .on("GET", `${CLAIM}/moisture-logs`, () => json(page([visit(2), visit(1)])))
    .on("GET", `${CLAIM}/drying-log`, () => json({ visits: [], rooms: [], atmosphere: [] }))
    .on("GET", `${CLAIM}/drying-status`, () => json(status(1)));
  const gets = (path: string) =>
    server.calls.filter(
      (call) => call.startsWith(`GET ${CLAIM}${path}?`) || call.startsWith(`GET ${CLAIM}${path} `),
    ).length;
  return { server, gets };
}

/** Everything a drying screen shows, loaded, with a mutation alongside. */
async function withDrying<Mutation>(server: FakeServer, useMutation: () => Mutation) {
  const rendered = renderWithApi(
    () => ({
      points: useMoisturePoints(ORG_ID, CLAIM_ID),
      visits: useMoistureLogs(ORG_ID, CLAIM_ID),
      table: useDryingLog(ORG_ID, CLAIM_ID),
      status: useDryingStatus(ORG_ID, CLAIM_ID),
      change: useMutation(),
    }),
    { server },
  );
  await waitFor(() => {
    const { points, visits, table, status } = rendered.result.current;
    expect(points.data && visits.data && table.data && status.data).toBeDefined();
  });
  return rendered;
}

test("points can be narrowed to one room", async () => {
  const { server } = dryingServer();

  const { result } = renderWithApi(
    () => useMoisturePoints(ORG_ID, CLAIM_ID, { room_id: KITCHEN.id }),
    { server },
  );

  await waitFor(() => {
    expect(result.current.data).toHaveLength(2);
  });
  expect(server.calls).toEqual([`GET ${CLAIM}/moisture-points?room_id=${KITCHEN.id} access-1`]);
});

describe("a visit", () => {
  test("recorded, it refreshes the visits and both drying views", async () => {
    const { server, gets } = dryingServer();
    let drying = 1;
    server
      .on("GET", `${CLAIM}/drying-status`, () => json(status(drying)))
      .on("POST", `${CLAIM}/moisture-logs`, () => {
        drying = 0; // the reading met the goal
        return json(visit(3), 201);
      });
    const { result, queryClient } = await withDrying(server, () =>
      useCreateMoistureLog(ORG_ID, CLAIM_ID),
    );

    await act(() =>
      result.current.change.mutateAsync({ readings: [{ point_id: point(1).id, value: 11 }] }),
    );

    await waitFor(() => {
      expect(result.current.status.data?.summary.all_dry).toBe(true);
    });
    expect([gets("/moisture-logs"), gets("/drying-log"), gets("/drying-status")]).toEqual([
      2, 2, 2,
    ]);
    expect(gets("/moisture-points")).toBe(1); // points didn't change
    expect(queryClient.getQueryData(queryKeys.moistureLog(ORG_ID, CLAIM_ID, visit(3).id))).toEqual(
      visit(3),
    );
  });

  test("deleted, it leaves the loaded pages at once", async () => {
    const { server, gets } = dryingServer();
    server.on("DELETE", `${CLAIM}/moisture-logs/${visit(2).id}`, noContent);
    const { result } = await withDrying(server, () => useDeleteMoistureLog(ORG_ID, CLAIM_ID));

    await act(() => result.current.change.mutateAsync(visit(2).id));

    await waitFor(() => {
      expect(allItems(result.current.visits.data).map((v) => v.id)).toEqual([visit(1).id]);
    });
    expect(gets("/moisture-logs")).toBe(1);
    expect(gets("/drying-status")).toBe(2);
  });
});

describe("a point", () => {
  test("moved, it is written from the answer and the lists and drying refetch", async () => {
    const { server, gets } = dryingServer();
    const moved = point(2, { room: { id: "0198a2c4-7b1e-7cc0-8000-000000000203", name: "Bath" } });
    server.on("PATCH", `${CLAIM}/moisture-points/${moved.id}`, () => json(moved));
    const { result, queryClient } = await withDrying(server, () =>
      useUpdateMoisturePoint(ORG_ID, CLAIM_ID),
    );

    await act(() =>
      result.current.change.mutateAsync({ pointId: moved.id, changes: { room_id: moved.room.id } }),
    );

    expect(queryClient.getQueryData(queryKeys.moisturePoint(ORG_ID, CLAIM_ID, moved.id))).toEqual(
      moved,
    );
    expect([gets("/moisture-points"), gets("/drying-log"), gets("/drying-status")]).toEqual([
      2, 2, 2,
    ]);
    expect(gets("/moisture-logs")).toBe(1);
  });

  test("deleted, its readings leave the visits too", async () => {
    const { server, gets } = dryingServer();
    server.on("DELETE", `${CLAIM}/moisture-points/${point(2).id}`, noContent);
    const { result } = await withDrying(server, () => useDeleteMoisturePoint(ORG_ID, CLAIM_ID));

    await act(() => result.current.change.mutateAsync(point(2).id));

    expect([
      gets("/moisture-points"),
      gets("/moisture-logs"),
      gets("/drying-log"),
      gets("/drying-status"),
    ]).toEqual([2, 2, 2, 2]);
  });
});

test("renaming a room refreshes the points and drying views that name it", async () => {
  const { server, gets } = dryingServer();
  server.on("PATCH", `${CLAIM}/rooms/${KITCHEN.id}`, () =>
    json({
      id: KITCHEN.id,
      structure_id: "0198a2c4-7b1e-7cc0-8000-000000000101",
      name: "Galley kitchen",
      level: null,
      length_ft: null,
      width_ft: null,
      height_ft: null,
      floor_area_sqft: null,
      wall_area_sqft: null,
      volume_cuft: null,
      created_at: "2026-11-16T12:00:00Z",
      updated_at: "2026-11-16T12:00:00Z",
    }),
  );
  const { result } = await withDrying(server, () => useUpdateRoom(ORG_ID, CLAIM_ID));

  await act(() =>
    result.current.change.mutateAsync({ roomId: KITCHEN.id, changes: { name: "Galley kitchen" } }),
  );

  expect([gets("/moisture-points"), gets("/drying-log"), gets("/drying-status")]).toEqual([
    2, 2, 2,
  ]);
});
