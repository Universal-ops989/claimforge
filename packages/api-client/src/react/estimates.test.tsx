// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  useAddLine,
  useChangeEstimateStatus,
  useCreateEstimate,
  useDeleteEstimate,
  useEstimate,
  useEstimates,
  useUpdateLine,
} from "./index";
import {
  CLAIM_ID,
  FakeServer,
  json,
  MORGAN,
  noContent,
  ORG_ID,
  problem,
  renderWithApi,
} from "./testing";

afterEach(cleanup);

const ESTIMATES = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}/estimates`;
const FIRST = "0198a2c4-7b1e-7cc0-8000-000000000901";
const SECOND = "0198a2c4-7b1e-7cc0-8000-000000000902";
const LINE = "0198a2c4-7b1e-7cc0-8000-000000000911";

/** A one-line estimate; `quantity` drives the totals, `minute` the updated_at. */
function estimate({
  id = FIRST,
  number = 1,
  quantity = "1",
  minute = 0,
  status = "draft",
}: {
  id?: string;
  number?: number;
  quantity?: string;
  minute?: number;
  status?: Schema<"EstimateStatus">;
} = {}): Schema<"EstimateRead"> {
  const total = (Number(quantity) * 100).toFixed(2);
  return {
    id,
    claim_id: CLAIM_ID,
    number,
    title: `Estimate ${String(number)}`,
    status,
    next_statuses: status === "draft" ? ["submitted"] : ["approved", "rejected"],
    notes: null,
    price_list: null,
    tax_percent: "0",
    overhead_percent: "0",
    profit_percent: "0",
    lines: [
      {
        id: LINE,
        position: 1,
        code: "WTR-DRY",
        description: "Dehumidifier, per day",
        quantity,
        unit: "EA",
        unit_price: "100.00",
        total,
        taxable: false,
        notes: null,
        room: null,
        price_item_id: null,
      },
    ],
    rooms: [],
    totals: {
      subtotal: total,
      taxable_subtotal: "0.00",
      tax: "0.00",
      overhead: "0.00",
      profit: "0.00",
      total,
    },
    total,
    created_by: MORGAN,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: `2026-11-16T12:${String(minute).padStart(2, "0")}:00Z`,
  };
}

function summary(of: Schema<"EstimateRead">): Schema<"EstimateSummary"> {
  const { id, claim_id, number, title, status, total, created_at, updated_at } = of;
  return { id, claim_id, number, title, status, total, created_at, updated_at };
}

/** Lists estimate 1 and serves its detail; counts GETs by path. */
function estimateServer(detail = () => estimate()) {
  const server = new FakeServer()
    .on("GET", ESTIMATES, () => json([summary(estimate())]))
    .on("GET", `${ESTIMATES}/${FIRST}`, () => json(detail()));
  const gets = (path: string) =>
    server.calls.filter((call) => call.startsWith(`GET ${path} `)).length;
  return { server, gets };
}

async function withEstimate<Mutation>(server: FakeServer, useMutation: () => Mutation) {
  const rendered = renderWithApi(
    () => ({
      list: useEstimates(ORG_ID, CLAIM_ID),
      detail: useEstimate(ORG_ID, CLAIM_ID, FIRST),
      change: useMutation(),
    }),
    { server },
  );
  await waitFor(() => {
    const { list, detail } = rendered.result.current;
    expect(list.data && detail.data).toBeDefined();
  });
  return rendered;
}

describe("lines", () => {
  test("a new line updates the estimate and its total in the list, without a refetch", async () => {
    const { server, gets } = estimateServer();
    server.on("POST", `${ESTIMATES}/${FIRST}/lines`, () =>
      json(estimate({ quantity: "3", minute: 1 }), 201),
    );
    const { result } = await withEstimate(server, () => useAddLine(ORG_ID, CLAIM_ID, FIRST));

    await act(() => result.current.change.mutateAsync({ quantity: "2", code: "WTR-DRY" }));

    await waitFor(() => {
      expect(result.current.detail.data?.totals.total).toBe("300.00");
    });
    expect(result.current.list.data?.map((e) => e.total)).toEqual(["300.00"]);
    expect([gets(ESTIMATES), gets(`${ESTIMATES}/${FIRST}`)]).toEqual([1, 1]);
  });

  test("an older answer arriving last doesn't overwrite a newer one", async () => {
    const answers: ((response: Response) => void)[] = [];
    const { server } = estimateServer();
    server.on(
      "PATCH",
      `${ESTIMATES}/${FIRST}/lines/${LINE}`,
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        }),
    );
    const { result, queryClient } = await withEstimate(server, () =>
      useUpdateLine(ORG_ID, CLAIM_ID, FIRST),
    );

    // Typed 2, then 5: the API applies them in order, but answers the 2 last.
    act(() => {
      result.current.change.mutate({ lineId: LINE, changes: { quantity: "2" } });
      result.current.change.mutate({ lineId: LINE, changes: { quantity: "5" } });
    });
    await waitFor(() => {
      expect(answers).toHaveLength(2);
    });
    act(() => {
      answers[1]?.(json(estimate({ quantity: "5", minute: 2 })));
    });
    await waitFor(() => {
      expect(result.current.detail.data?.total).toBe("500.00");
    });
    act(() => {
      answers[0]?.(json(estimate({ quantity: "2", minute: 1 })));
    });
    // `isPending` follows only the latest mutate; wait until the older one is handled too.
    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(0);
    });

    expect(result.current.detail.data?.lines[0]?.quantity).toBe("5");
    expect(result.current.list.data?.[0]?.total).toBe("500.00");
  });

  test("an estimate submitted meanwhile is refetched and shows locked", async () => {
    let status: Schema<"EstimateStatus"> = "draft";
    const { server, gets } = estimateServer(() => estimate({ status }));
    server.on("POST", `${ESTIMATES}/${FIRST}/lines`, () => {
      status = "submitted"; // a teammate sent it to the carrier first
      return problem(409, "estimate_not_draft");
    });
    const { result } = await withEstimate(server, () => useAddLine(ORG_ID, CLAIM_ID, FIRST));

    await act(async () => {
      await result.current.change.mutateAsync({ quantity: "1" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.detail.data?.status).toBe("submitted");
    });
    expect(gets(ESTIMATES)).toBe(2);
  });
});

describe("estimates", () => {
  test("a new estimate joins the list in number order", async () => {
    const { server } = estimateServer();
    server.on("POST", ESTIMATES, () => json(estimate({ id: SECOND, number: 2 }), 201));
    const { result } = await withEstimate(server, () => useCreateEstimate(ORG_ID, CLAIM_ID));

    await act(() => result.current.change.mutateAsync({ title: "Estimate 2" }));

    await waitFor(() => {
      expect(result.current.list.data?.map((e) => e.number)).toEqual([1, 2]);
    });
  });

  test("submitting writes the new status and where it can go next", async () => {
    const { server } = estimateServer();
    server.on("POST", `${ESTIMATES}/${FIRST}/status`, () =>
      json(estimate({ status: "submitted", minute: 1 })),
    );
    const { result } = await withEstimate(server, () =>
      useChangeEstimateStatus(ORG_ID, CLAIM_ID, FIRST),
    );

    await act(() => result.current.change.mutateAsync("submitted"));

    await waitFor(() => {
      expect(result.current.detail.data?.next_statuses).toEqual(["approved", "rejected"]);
    });
    expect(result.current.list.data?.[0]?.status).toBe("submitted");
  });

  test("a deleted draft leaves the list", async () => {
    const { server } = estimateServer();
    server.on("DELETE", `${ESTIMATES}/${FIRST}`, noContent);
    const { result } = renderWithApi(
      () => ({ list: useEstimates(ORG_ID, CLAIM_ID), remove: useDeleteEstimate(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    await act(() => result.current.remove.mutateAsync(FIRST));

    await waitFor(() => {
      expect(result.current.list.data).toEqual([]);
    });
  });
});
