// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  allItems,
  claimQuery,
  queryKeys,
  useAssignClaim,
  useChangeClaimStatus,
  useClaim,
  useClaimByNumber,
  useClaims,
  useClaimStatusHistory,
  useClaimTimeline,
  useCreateClaim,
  useUnassignClaim,
  useUpdateClaim,
} from "./index";
import {
  claim,
  CLAIM_ID,
  CLAIM_NUMBER,
  FakeServer,
  json,
  MORGAN,
  noContent,
  ORG_ID,
  problem,
  renderWithApi,
  RILEY,
} from "./testing";

afterEach(cleanup);

const CLAIMS = `/v1/organizations/${ORG_ID}/claims`;
const CLAIM = `${CLAIMS}/${CLAIM_ID}`;

function summary(number: string): Schema<"ClaimSummary"> {
  const { id, status, loss_type, loss_date, policy_number, carrier_name, carrier_claim_number } =
    claim();
  return {
    id,
    number,
    status,
    loss_type,
    loss_date,
    policy_number,
    carrier_name,
    carrier_claim_number,
    property: claim().property,
    primary_contact: null,
    adjuster: null,
    created_at: "2026-11-10T15:00:00Z",
    updated_at: "2026-11-10T15:00:00Z",
  };
}

function entry(summaryText: string): Schema<"TimelineEntry"> {
  return {
    id: "0198a2c4-7b1e-7cc0-8000-0000000000f1",
    at: "2026-11-16T12:00:00Z",
    kind: "status",
    action: "status_changed",
    actor: MORGAN,
    subject: { type: "claim", id: CLAIM_ID },
    summary: summaryText,
    changes: {},
  };
}

const assignment = (user: { id: string; full_name: string }): Schema<"ClaimAssignmentRead"> => ({
  user,
  role: "field_technician",
  assigned_at: "2026-11-16T12:00:00Z",
  assigned_by_id: MORGAN.id,
});

/** GETs of exactly `path`, whatever their query string. */
const gets = (calls: string[], path: string) =>
  calls.filter((call) => call.startsWith(`GET ${path}?`) || call.startsWith(`GET ${path} `)).length;

describe("reading claims", () => {
  test("lists send every filter and page on", async () => {
    const server = new FakeServer().on("GET", CLAIMS, (request) =>
      json(
        new URL(request.url).searchParams.has("cursor")
          ? { items: [summary("CF-2026-0041")], next_cursor: null, has_more: false }
          : { items: [summary(CLAIM_NUMBER)], next_cursor: "c1", has_more: true },
      ),
    );

    const { result } = renderWithApi(
      () => useClaims(ORG_ID, { status: ["new", "in_progress"], sort: "-loss_date" }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
    await act(() => result.current.fetchNextPage());

    await waitFor(() => {
      expect(allItems(result.current.data).map((c) => c.number)).toEqual([
        CLAIM_NUMBER,
        "CF-2026-0041",
      ]);
    });
    expect(server.calls).toEqual([
      `GET ${CLAIMS}?status=new&status=in_progress&sort=-loss_date access-1`,
      `GET ${CLAIMS}?status=new&status=in_progress&sort=-loss_date&cursor=c1 access-1`,
    ]);
  });

  test("a claim fetched by number is cached by id as well", async () => {
    const server = new FakeServer().on("GET", `${CLAIMS}/by-number/${CLAIM_NUMBER}`, () =>
      json(claim()),
    );
    const { result, api, queryClient } = renderWithApi(
      () => useClaimByNumber(ORG_ID, CLAIM_NUMBER),
      { server },
    );
    await waitFor(() => {
      expect(result.current.data?.id).toBe(CLAIM_ID);
    });

    // What useClaim(ORG_ID, CLAIM_ID) would read: fresh, so no request.
    const byId = await queryClient.query(claimQuery(api, ORG_ID, CLAIM_ID));

    expect(byId.number).toBe(CLAIM_NUMBER);
    expect(gets(server.calls, CLAIM)).toBe(0);
  });
});

describe("changing claims", () => {
  test("creating one caches it and refreshes the lists", async () => {
    const server = new FakeServer()
      .on("GET", CLAIMS, () => json({ items: [], next_cursor: null, has_more: false }))
      .on("POST", CLAIMS, () => json(claim(), 201));
    const { result, queryClient } = renderWithApi(
      () => ({ list: useClaims(ORG_ID), create: useCreateClaim(ORG_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });

    await act(() =>
      result.current.create.mutateAsync({
        loss_type: "water",
        property_id: claim().property.id,
      }),
    );

    expect(queryClient.getQueryData(queryKeys.claim(ORG_ID, CLAIM_ID))).toEqual(claim());
    expect(queryClient.getQueryData(queryKeys.claimByNumber(ORG_ID, CLAIM_NUMBER))).toEqual(
      claim(),
    );
    expect(gets(server.calls, CLAIMS)).toBe(2);
  });

  test("an update lands under both keys and refreshes the timeline", async () => {
    const edited = claim({ description: "Burst supply line, kitchen and hallway" });
    const server = new FakeServer()
      .on("GET", `${CLAIMS}/by-number/${CLAIM_NUMBER}`, () => json(claim()))
      .on("GET", `${CLAIM}/timeline`, () =>
        json({ items: [entry("Claim opened")], next_cursor: null, has_more: false }),
      )
      .on("PATCH", CLAIM, () => json(edited));
    const { result } = renderWithApi(
      () => ({
        shown: useClaimByNumber(ORG_ID, CLAIM_NUMBER),
        timeline: useClaimTimeline(ORG_ID, CLAIM_ID),
        update: useUpdateClaim(ORG_ID, CLAIM_ID),
      }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.shown.isSuccess && result.current.timeline.isSuccess).toBe(true);
    });

    await act(() => result.current.update.mutateAsync({ description: edited.description }));

    await waitFor(() => {
      expect(result.current.shown.data?.description).toBe(edited.description);
    });
    expect(gets(server.calls, `${CLAIMS}/by-number/${CLAIM_NUMBER}`)).toBe(1);
    expect(gets(server.calls, `${CLAIM}/timeline`)).toBe(2);
  });
});

describe("status changes", () => {
  function statusServer(answer: (body: Schema<"ClaimStatusChangeCreate">) => Response) {
    const sent: Schema<"ClaimStatusChangeCreate">[] = [];
    let history: Schema<"ClaimStatusChangeRead">[] = [];
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim()))
      .on("GET", `${CLAIM}/status-history`, () => json(history))
      .on("POST", `${CLAIM}/status`, async (request) => {
        const body = (await request.json()) as Schema<"ClaimStatusChangeCreate">;
        sent.push(body);
        history = [
          {
            id: "0198a2c4-7b1e-7cc0-8000-0000000000f2",
            from_status: "new",
            to_status: body.status,
            reason: null,
            changed_by: MORGAN,
            changed_at: "2026-11-16T12:00:00Z",
          },
        ];
        return answer(body);
      });
    return { server, sent };
  }

  test("the status the user saw goes along as expected_status", async () => {
    const { server, sent } = statusServer((body) =>
      json(claim({ status: body.status, next_statuses: ["in_progress", "on_hold"] })),
    );
    const { result } = renderWithApi(
      () => ({
        claim: useClaim(ORG_ID, CLAIM_ID),
        history: useClaimStatusHistory(ORG_ID, CLAIM_ID),
        change: useChangeClaimStatus(ORG_ID, CLAIM_ID),
      }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.history.data).toEqual([]);
    });

    await act(() => result.current.change.mutateAsync({ status: "inspected" }));

    expect(sent).toEqual([{ expected_status: "new", status: "inspected" }]);
    await waitFor(() => {
      expect(result.current.history.data?.map((change) => change.to_status)).toEqual(["inspected"]);
    });
    expect(result.current.claim.data?.next_statuses).toEqual(["in_progress", "on_hold"]);
    expect(gets(server.calls, CLAIM)).toBe(1); // the answer was the new claim
  });

  test("an explicit expected_status wins, null included", async () => {
    const { server, sent } = statusServer((body) => json(claim({ status: body.status })));
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), change: useChangeClaimStatus(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.isSuccess).toBe(true);
    });

    await act(() =>
      result.current.change.mutateAsync({
        status: "on_hold",
        expected_status: null,
        reason: "Waiting on the carrier",
      }),
    );

    expect(sent).toEqual([
      { expected_status: null, status: "on_hold", reason: "Waiting on the carrier" },
    ]);
  });

  test("a claim someone else moved is refetched, not overwritten", async () => {
    let current: Schema<"ClaimStatus"> = "new";
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim({ status: current })))
      .on("POST", `${CLAIM}/status`, () => {
        current = "inspected"; // a teammate got there first
        return problem(409, "status_changed");
      });
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), change: useChangeClaimStatus(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.data?.status).toBe("new");
    });

    await act(async () => {
      await result.current.change.mutateAsync({ status: "cancelled" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.claim.data?.status).toBe("inspected");
    });
    expect(result.current.change.error).toMatchObject({ code: "status_changed" });
  });
});

describe("assignments", () => {
  test("assigning adds the person to the cached claim", async () => {
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim({ assignments: [assignment(MORGAN)] })))
      .on("POST", `${CLAIM}/assignments`, () => json(assignment(RILEY), 201));
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), assign: useAssignClaim(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.isSuccess).toBe(true);
    });

    await act(() =>
      result.current.assign.mutateAsync({ user_id: RILEY.id, role: "field_technician" }),
    );

    await waitFor(() => {
      expect(result.current.claim.data?.assignments.map((a) => a.user.full_name)).toEqual([
        "Morgan Member",
        "Riley Tech",
      ]);
    });
    expect(gets(server.calls, CLAIM)).toBe(1);
  });

  test("unassigning shows at once and is undone if refused", async () => {
    let answer: (response: Response) => void = () => undefined;
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim({ assignments: [assignment(MORGAN), assignment(RILEY)] })))
      .on(
        "DELETE",
        `${CLAIM}/assignments/${RILEY.id}`,
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), unassign: useUnassignClaim(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.data?.assignments).toHaveLength(2);
    });

    act(() => {
      result.current.unassign.mutate(RILEY.id);
    });
    await waitFor(() => {
      expect(result.current.claim.data?.assignments.map((a) => a.user.id)).toEqual([MORGAN.id]);
    });
    expect(result.current.unassign.isPending).toBe(true);

    act(() => {
      answer(problem(403, "permission_denied"));
    });
    await waitFor(() => {
      expect(result.current.claim.data?.assignments).toHaveLength(2);
    });
    expect(result.current.unassign.error).toMatchObject({ code: "permission_denied" });
  });

  test("an accepted unassign stays done", async () => {
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim({ assignments: [assignment(RILEY)] })))
      .on("DELETE", `${CLAIM}/assignments/${RILEY.id}`, noContent);
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), unassign: useUnassignClaim(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.data?.assignments).toHaveLength(1);
    });

    await act(() => result.current.unassign.mutateAsync(RILEY.id));

    await waitFor(() => {
      expect(result.current.claim.data?.assignments).toEqual([]);
    });
    expect(gets(server.calls, CLAIM)).toBe(1); // the optimistic edit was right; no refetch
  });
});
