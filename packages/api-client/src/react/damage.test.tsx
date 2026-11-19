// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { damageItem, ids, structure } from "../fixtures";
import { useDamageItems, useDeleteRoom, useRecordDamage } from "./index";
import { CLAIM_ID, FakeServer, json, noContent, ORG_ID, renderWithApi } from "./testing";

afterEach(cleanup);

const CLAIM = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}`;

describe("damage items", () => {
  test("recording refetches the list: the API settles the cause and category", async () => {
    let items = [damageItem()];
    const server = new FakeServer()
      .on("GET", `${CLAIM}/damage-items`, () => json(items))
      .on("POST", `${CLAIM}/rooms/${ids.room}/damage-items`, () => {
        const sewage = damageItem({
          id: `${ids.damage.slice(0, -1)}2`,
          cause: "sewage",
          water_category: 3,
        });
        items = [...items, sewage];
        return json(sewage, 201);
      });
    const { result } = renderWithApi(
      () => ({
        items: useDamageItems(ORG_ID, CLAIM_ID),
        record: useRecordDamage(ORG_ID, CLAIM_ID),
      }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.items.data).toHaveLength(1);
    });

    await act(() =>
      result.current.record.mutateAsync({
        roomId: ids.room,
        item: { surface: "floor", material: "Carpet", cause: "sewage" },
      }),
    );

    await waitFor(() => {
      expect(result.current.items.data?.map((i) => i.water_category)).toEqual([1, 3]);
    });
  });

  test("deleting a room refreshes the damage that went with it", async () => {
    let items = [damageItem()];
    const server = new FakeServer()
      .on("GET", `${CLAIM}/structures`, () => json([structure()]))
      .on("GET", `${CLAIM}/damage-items`, () => json(items))
      .on("DELETE", `${CLAIM}/rooms/${ids.room}`, () => {
        items = [];
        return noContent();
      });
    const { result } = renderWithApi(
      () => ({ items: useDamageItems(ORG_ID, CLAIM_ID), remove: useDeleteRoom(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.items.data).toHaveLength(1);
    });

    await act(() => result.current.remove.mutateAsync(ids.room));

    await waitFor(() => {
      expect(result.current.items.data).toEqual([]);
    });
  });
});
