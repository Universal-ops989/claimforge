// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { equipment, placement } from "../fixtures";
import { useEquipment, useEquipmentDays, usePlaceEquipment, usePlacements } from "./index";
import { CLAIM_ID, FakeServer, json, ORG_ID, renderWithApi } from "./testing";

afterEach(cleanup);

const CLAIM = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}`;
const FLEET = `/v1/organizations/${ORG_ID}/equipment`;

test("placing a unit refreshes the placements, the billable days and the fleet", async () => {
  let placed = false;
  const asked = { placements: 0, days: 0, fleet: 0 };
  const server = new FakeServer()
    .on("GET", `${CLAIM}/equipment-placements`, () => {
      asked.placements += 1;
      return json(placed ? [placement()] : []);
    })
    .on("GET", `${CLAIM}/equipment-days`, () => {
      asked.days += 1;
      return json([]);
    })
    .on("GET", FLEET, () => {
      asked.fleet += 1;
      return json({ items: [equipment()], next_cursor: null, has_more: false });
    })
    .on("POST", `${CLAIM}/equipment-placements`, () => {
      placed = true;
      return json(placement(), 201);
    });
  const { result } = renderWithApi(
    () => ({
      placements: usePlacements(ORG_ID, CLAIM_ID),
      days: useEquipmentDays(ORG_ID, CLAIM_ID),
      fleet: useEquipment(ORG_ID, { available: true }),
      place: usePlaceEquipment(ORG_ID, CLAIM_ID),
    }),
    { server },
  );
  await waitFor(() => {
    expect(result.current.fleet.data).toBeDefined();
  });

  await act(() =>
    result.current.place.mutateAsync({
      equipment_id: equipment().id,
      room_id: placement().room.id,
    }),
  );

  await waitFor(() => {
    expect(result.current.placements.data).toHaveLength(1);
  });
  expect(asked).toEqual({ placements: 2, days: 2, fleet: 2 });
});
