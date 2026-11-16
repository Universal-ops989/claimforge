/**
 * A claim's layout: its structures (house, garage, …) and the rooms in each.
 *
 * The API returns the whole layout in one answer, structures with their rooms nested, both
 * in the order they were added (by id; ids are UUIDv7, so that is creation order). That
 * cached layout is what every change below edits, in the same order, so the screen updates
 * without a refetch. Only the timeline, which gains an entry, is refetched.
 *
 * Deletes wait for the API rather than hiding the item first: a room with moisture points
 * or equipment history is refused (409 `has_moisture_points`, …), and that is common
 * enough that an optimistic delete would flicker.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { RequestBody, Schema } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";

type Structure = Schema<"StructureRead">;
type Room = Schema<"RoomRead">;

const STRUCTURES = "/v1/organizations/{organization_id}/claims/{claim_id}/structures";
const STRUCTURE = `${STRUCTURES}/{structure_id}` as const;
const ROOM = "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}";

// ─── Reading ─────────────────────────────────────────────────────────────────

/** The claim's structures, each with its rooms. */
export function structuresQuery(api: ApiClient, organizationId: string, claimId: string) {
  return queryOptions({
    queryKey: queryKeys.structures(organizationId, claimId),
    queryFn: ({ signal }) =>
      api.get(STRUCTURES, {
        path: { organization_id: organizationId, claim_id: claimId },
        signal,
      }),
  });
}

export function useStructures(organizationId: string, claimId: string) {
  return useQuery(structuresQuery(useApi(), organizationId, claimId));
}

export function roomQuery(api: ApiClient, organizationId: string, claimId: string, roomId: string) {
  return queryOptions({
    queryKey: queryKeys.room(organizationId, claimId, roomId),
    queryFn: ({ signal }) =>
      api.get(ROOM, {
        path: { organization_id: organizationId, claim_id: claimId, room_id: roomId },
        signal,
      }),
  });
}

/** One room. If the layout is loaded it shows at once, and is as fresh as the layout. */
export function useRoom(organizationId: string, claimId: string, roomId: string) {
  const queryClient = useQueryClient();
  const layout = queryKeys.structures(organizationId, claimId);
  return useQuery({
    ...roomQuery(useApi(), organizationId, claimId, roomId),
    initialData: () =>
      queryClient
        .getQueryData<Structure[]>(layout)
        ?.flatMap((structure) => structure.rooms)
        .find((room) => room.id === roomId),
    initialDataUpdatedAt: () => queryClient.getQueryState(layout)?.dataUpdatedAt,
  });
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

/** Put `item` in `items`, replacing the one with its id, keeping the API's id order. */
function place<Item extends { id: string }>(items: readonly Item[], item: Item): Item[] {
  return [...items.filter((other) => other.id !== item.id), item].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

function editLayout(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  edit: (structures: Structure[]) => Structure[],
): void {
  queryClient.setQueryData<Structure[]>(queryKeys.structures(organizationId, claimId), (layout) =>
    layout ? edit(layout) : layout,
  );
}

/** Write a room the API returned into the layout (wherever it now lives) and its detail. */
function writeRoom(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  room: Room,
): void {
  editLayout(queryClient, organizationId, claimId, (structures) =>
    structures.map((structure) => {
      const others = structure.rooms.filter((other) => other.id !== room.id);
      return {
        ...structure,
        rooms: structure.id === room.structure_id ? place(others, room) : others,
      };
    }),
  );
  queryClient.setQueryData<Room>(queryKeys.room(organizationId, claimId, room.id), room);
}

/** Drop a deleted room's cache: its detail and anything recorded under it. */
function forgetRoom(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  roomId: string,
): void {
  queryClient.removeQueries({ queryKey: queryKeys.room(organizationId, claimId, roomId) });
}

function refreshTimeline(queryClient: QueryClient, organizationId: string, claimId: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.timelines(organizationId, claimId) });
}

/**
 * After a room is renamed or deleted: the timeline, and what shows the room's name: its
 * photos (a deleted room's photos become unassigned), moisture points and drying views.
 */
async function refreshRoomViews(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
): Promise<void> {
  await Promise.all([
    refreshTimeline(queryClient, organizationId, claimId),
    ...[
      queryKeys.photos(organizationId, claimId),
      queryKeys.moisturePoints(organizationId, claimId),
      queryKeys.drying(organizationId, claimId),
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ]);
}

// ─── Structures ──────────────────────────────────────────────────────────────

export function useCreateStructure(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof STRUCTURES, "post">) =>
      api.post(STRUCTURES, {
        path: { organization_id: organizationId, claim_id: claimId },
        body,
      }),
    onSuccess: async (created) => {
      editLayout(queryClient, organizationId, claimId, (structures) => place(structures, created));
      await refreshTimeline(queryClient, organizationId, claimId);
    },
  });
}

export interface StructureChange {
  structureId: string;
  changes: RequestBody<typeof STRUCTURE, "patch">;
}

/** Rename a structure; `mutate({ structureId, changes: { name } })`. */
export function useUpdateStructure(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ structureId, changes }: StructureChange) =>
      api.patch(STRUCTURE, {
        path: { organization_id: organizationId, claim_id: claimId, structure_id: structureId },
        body: changes,
      }),
    onSuccess: async (updated) => {
      editLayout(queryClient, organizationId, claimId, (structures) => place(structures, updated));
      await refreshTimeline(queryClient, organizationId, claimId);
    },
  });
}

/** Delete a structure with every room (and damage item) in it. */
export function useDeleteStructure(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (structureId: string) =>
      api.delete(STRUCTURE, {
        path: { organization_id: organizationId, claim_id: claimId, structure_id: structureId },
      }),
    onSuccess: async (_, structureId) => {
      const layout = queryClient.getQueryData<Structure[]>(
        queryKeys.structures(organizationId, claimId),
      );
      for (const room of layout?.find((structure) => structure.id === structureId)?.rooms ?? []) {
        forgetRoom(queryClient, organizationId, claimId, room.id);
      }
      editLayout(queryClient, organizationId, claimId, (structures) =>
        structures.filter((structure) => structure.id !== structureId),
      );
      await refreshRoomViews(queryClient, organizationId, claimId);
    },
  });
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export interface NewRoom {
  structureId: string;
  room: RequestBody<`${typeof STRUCTURE}/rooms`, "post">;
}

/** Add a room to a structure; `mutate({ structureId, room: { name, length_ft, … } })`. */
export function useCreateRoom(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ structureId, room }: NewRoom) =>
      api.post(`${STRUCTURE}/rooms`, {
        path: { organization_id: organizationId, claim_id: claimId, structure_id: structureId },
        body: room,
      }),
    onSuccess: async (created) => {
      writeRoom(queryClient, organizationId, claimId, created);
      await refreshTimeline(queryClient, organizationId, claimId);
    },
  });
}

export interface RoomChange {
  roomId: string;
  changes: RequestBody<typeof ROOM, "patch">;
}

/**
 * Rename, re-measure or move a room; `changes.structure_id` moves it to another structure
 * of the claim. The answer carries the derived areas and volume, so the layout shows them.
 */
export function useUpdateRoom(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, changes }: RoomChange) =>
      api.patch(ROOM, {
        path: { organization_id: organizationId, claim_id: claimId, room_id: roomId },
        body: changes,
      }),
    onSuccess: async (updated) => {
      writeRoom(queryClient, organizationId, claimId, updated);
      await refreshRoomViews(queryClient, organizationId, claimId);
    },
  });
}

/** Delete a room and its damage items; refused (409) once it holds drying evidence. */
export function useDeleteRoom(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) =>
      api.delete(ROOM, {
        path: { organization_id: organizationId, claim_id: claimId, room_id: roomId },
      }),
    onSuccess: async (_, roomId) => {
      forgetRoom(queryClient, organizationId, claimId, roomId);
      editLayout(queryClient, organizationId, claimId, (structures) =>
        structures.map((structure) => ({
          ...structure,
          rooms: structure.rooms.filter((room) => room.id !== roomId),
        })),
      );
      await refreshRoomViews(queryClient, organizationId, claimId);
    },
  });
}
