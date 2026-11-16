// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  queryKeys,
  useClaimTimeline,
  useCreateRoom,
  useCreateStructure,
  useDeleteRoom,
  useDeleteStructure,
  useRoom,
  useStructures,
  useUpdateRoom,
  useUpdateStructure,
} from "./index";
import { CLAIM_ID, FakeServer, json, noContent, ORG_ID, problem, renderWithApi } from "./testing";

afterEach(cleanup);

const CLAIM = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}`;
// Ids sort in creation order, as UUIDv7 does.
const HOUSE = "0198a2c4-7b1e-7cc0-8000-000000000101";
const GARAGE = "0198a2c4-7b1e-7cc0-8000-000000000102";
const SHED = "0198a2c4-7b1e-7cc0-8000-000000000103";
const KITCHEN = "0198a2c4-7b1e-7cc0-8000-000000000201";
const HALL = "0198a2c4-7b1e-7cc0-8000-000000000202";
const BATH = "0198a2c4-7b1e-7cc0-8000-000000000203";

function room(id: string, name: string, structureId = HOUSE): Schema<"RoomRead"> {
  return {
    id,
    structure_id: structureId,
    name,
    level: "1",
    length_ft: 12,
    width_ft: 10,
    height_ft: 8,
    floor_area_sqft: 120,
    wall_area_sqft: 352,
    volume_cuft: 960,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
  };
}

function structure(id: string, name: string, rooms: Schema<"RoomRead">[] = []) {
  return {
    id,
    name,
    rooms,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
  } satisfies Schema<"StructureRead">;
}

/** House (kitchen, bath) and an empty garage, plus a timeline; counts GETs per path. */
function layoutServer() {
  const server = new FakeServer()
    .on("GET", `${CLAIM}/structures`, () =>
      json([
        structure(HOUSE, "House", [room(KITCHEN, "Kitchen"), room(BATH, "Bath")]),
        structure(GARAGE, "Garage"),
      ]),
    )
    .on("GET", `${CLAIM}/timeline`, () => json({ items: [], next_cursor: null, has_more: false }));
  const gets = (path: string) =>
    server.calls.filter((call) => call.startsWith(`GET ${CLAIM}${path} `)).length;
  return { server, gets };
}

/** The layout as text: "House: Kitchen, Bath | Garage: ". */
function shown(layout: Schema<"StructureRead">[] | undefined): string | undefined {
  return layout?.map((s) => `${s.name}: ${s.rooms.map((r) => r.name).join(", ")}`).join(" | ");
}

/** The layout and the timeline, loaded, with the given mutation hook alongside. */
async function withLayout<Mutation>(server: FakeServer, useMutation: () => Mutation) {
  const rendered = renderWithApi(
    () => ({
      layout: useStructures(ORG_ID, CLAIM_ID),
      timeline: useClaimTimeline(ORG_ID, CLAIM_ID),
      change: useMutation(),
    }),
    { server },
  );
  await waitFor(() => {
    // Read `data`, not just a status: hooks re-render only for what was read.
    const { layout, timeline } = rendered.result.current;
    expect(layout.data && timeline.data).toBeDefined();
  });
  return rendered;
}

describe("reading", () => {
  test("a room opened from a loaded layout shows without a request", async () => {
    const { server, gets } = layoutServer();
    const { queryClient } = await withLayout(server, () => undefined);

    const { result } = renderWithApi(() => useRoom(ORG_ID, CLAIM_ID, BATH), {
      server,
      queryClient,
    });

    expect(result.current.data?.name).toBe("Bath");
    expect(result.current.isFetching).toBe(false); // fresh as the layout, so no request
    expect(gets(`/rooms/${BATH}`)).toBe(0);
  });

  test("a room the layout doesn't have yet is fetched", async () => {
    const server = new FakeServer().on("GET", `${CLAIM}/rooms/${HALL}`, () =>
      json(room(HALL, "Hall")),
    );

    const { result } = renderWithApi(() => useRoom(ORG_ID, CLAIM_ID, HALL), { server });

    await waitFor(() => {
      expect(result.current.data?.name).toBe("Hall");
    });
  });
});

describe("structures", () => {
  test("a new structure joins the layout in order, and the timeline refreshes", async () => {
    const { server, gets } = layoutServer();
    server.on("POST", `${CLAIM}/structures`, () => json(structure(SHED, "Shed"), 201));
    const { result } = await withLayout(server, () => useCreateStructure(ORG_ID, CLAIM_ID));

    await act(() => result.current.change.mutateAsync({ name: "Shed" }));

    await waitFor(() => {
      expect(shown(result.current.layout.data)).toBe("House: Kitchen, Bath | Garage:  | Shed: ");
    });
    expect(gets("/structures")).toBe(1);
    expect(gets("/timeline")).toBe(2);
  });

  test("renaming keeps its place and its rooms", async () => {
    const { server } = layoutServer();
    server.on("PATCH", `${CLAIM}/structures/${HOUSE}`, () =>
      json(structure(HOUSE, "Main house", [room(KITCHEN, "Kitchen"), room(BATH, "Bath")])),
    );
    const { result } = await withLayout(server, () => useUpdateStructure(ORG_ID, CLAIM_ID));

    await act(() =>
      result.current.change.mutateAsync({ structureId: HOUSE, changes: { name: "Main house" } }),
    );

    await waitFor(() => {
      expect(shown(result.current.layout.data)).toBe("Main house: Kitchen, Bath | Garage: ");
    });
  });

  test("deleting one drops it and the cached rooms in it", async () => {
    const { server } = layoutServer();
    server.on("DELETE", `${CLAIM}/structures/${HOUSE}`, noContent);
    const { result, queryClient } = await withLayout(server, () =>
      useDeleteStructure(ORG_ID, CLAIM_ID),
    );
    queryClient.setQueryData(queryKeys.room(ORG_ID, CLAIM_ID, KITCHEN), room(KITCHEN, "Kitchen"));

    await act(() => result.current.change.mutateAsync(HOUSE));

    await waitFor(() => {
      expect(shown(result.current.layout.data)).toBe("Garage: ");
    });
    expect(queryClient.getQueryData(queryKeys.room(ORG_ID, CLAIM_ID, KITCHEN))).toBeUndefined();
  });
});

describe("rooms", () => {
  test("a new room goes into its structure, in order", async () => {
    const { server, gets } = layoutServer();
    server.on("POST", `${CLAIM}/structures/${HOUSE}/rooms`, () => json(room(HALL, "Hall"), 201));
    const { result, queryClient } = await withLayout(server, () => useCreateRoom(ORG_ID, CLAIM_ID));

    await act(() =>
      result.current.change.mutateAsync({ structureId: HOUSE, room: { name: "Hall" } }),
    );

    await waitFor(() => {
      expect(shown(result.current.layout.data)).toBe("House: Kitchen, Hall, Bath | Garage: ");
    });
    expect(queryClient.getQueryData(queryKeys.room(ORG_ID, CLAIM_ID, HALL))).toEqual(
      room(HALL, "Hall"),
    );
    expect(gets("/structures")).toBe(1);
    expect(gets("/timeline")).toBe(2);
  });

  test("moving a room takes it out of one structure and into the other", async () => {
    const { server } = layoutServer();
    server.on("PATCH", `${CLAIM}/rooms/${BATH}`, () => json(room(BATH, "Bath", GARAGE)));
    const { result } = await withLayout(server, () => useUpdateRoom(ORG_ID, CLAIM_ID));

    await act(() =>
      result.current.change.mutateAsync({ roomId: BATH, changes: { structure_id: GARAGE } }),
    );

    await waitFor(() => {
      expect(shown(result.current.layout.data)).toBe("House: Kitchen | Garage: Bath");
    });
  });

  test("re-measuring shows the API's derived area", async () => {
    const { server } = layoutServer();
    server.on("PATCH", `${CLAIM}/rooms/${KITCHEN}`, () =>
      json({ ...room(KITCHEN, "Kitchen"), length_ft: 15, floor_area_sqft: 150 }),
    );
    const { result } = await withLayout(server, () => useUpdateRoom(ORG_ID, CLAIM_ID));

    await act(() =>
      result.current.change.mutateAsync({ roomId: KITCHEN, changes: { length_ft: 15 } }),
    );

    await waitFor(() => {
      expect(result.current.layout.data?.[0]?.rooms[0]?.floor_area_sqft).toBe(150);
    });
  });

  test("a deleted room leaves the layout", async () => {
    const { server } = layoutServer();
    server.on("DELETE", `${CLAIM}/rooms/${KITCHEN}`, noContent);
    const { result } = await withLayout(server, () => useDeleteRoom(ORG_ID, CLAIM_ID));

    await act(() => result.current.change.mutateAsync(KITCHEN));

    await waitFor(() => {
      expect(shown(result.current.layout.data)).toBe("House: Bath | Garage: ");
    });
  });

  test("a room the API won't delete stays", async () => {
    const { server } = layoutServer();
    server.on("DELETE", `${CLAIM}/rooms/${KITCHEN}`, () => problem(409, "has_moisture_points"));
    const { result } = await withLayout(server, () => useDeleteRoom(ORG_ID, CLAIM_ID));

    await act(async () => {
      await result.current.change.mutateAsync(KITCHEN).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.change.error).toMatchObject({ code: "has_moisture_points" });
    });
    expect(shown(result.current.layout.data)).toBe("House: Kitchen, Bath | Garage: ");
  });
});
