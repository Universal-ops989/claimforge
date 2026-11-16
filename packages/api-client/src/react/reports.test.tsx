// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  LINK_REFRESH_MS,
  queryKeys,
  REPORT_POLL_MS,
  reportQuery,
  reportsQuery,
  useDeleteReport,
  useReports,
  useReportShares,
  useRequestReport,
  useRevokeShare,
  useShareReport,
} from "./index";
import { CLAIM_ID, FakeServer, json, MORGAN, noContent, ORG_ID, renderWithApi } from "./testing";

afterEach(cleanup);

const REPORTS = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}/reports`;
const OLD = "0198a2c4-7b1e-7cc0-8000-000000000a01";
const NEW = "0198a2c4-7b1e-7cc0-8000-000000000a02";
const SHARE = "0198a2c4-7b1e-7cc0-8000-000000000b01";
const SHARE_URL = "https://app.test/shared/s3cr3t-t0k3n";

function report(id: string, status: Schema<"JobStatus">): Schema<"ReportJobRead"> {
  const ready = status === "ready";
  return {
    id,
    claim_id: CLAIM_ID,
    kind: "photo_report",
    status,
    download_url: ready ? `https://storage.test/${id}.pdf?sig=abc` : null,
    size_bytes: ready ? 52_000 : null,
    error: status === "failed" ? "No photos to report" : null,
    requested_by: MORGAN,
    created_at: "2026-11-16T12:00:00Z",
    finished_at: status === "queued" ? null : "2026-11-16T12:00:05Z",
  };
}

function share(active = true): Schema<"ShareRead"> {
  return {
    id: SHARE,
    report_id: OLD,
    label: "For the adjuster",
    active,
    expires_at: "2026-11-23T12:00:00Z",
    revoked_at: active ? null : "2026-11-16T13:00:00Z",
    open_count: 0,
    last_opened_at: null,
    created_by: MORGAN,
    created_at: "2026-11-16T12:00:00Z",
  };
}

describe("making reports", () => {
  test("polls while queued, refreshes ready links hourly, stops when nothing's left", () => {
    const { api } = renderWithApi(() => undefined);
    const look = (reports: Schema<"ReportJobRead">[]) =>
      (
        reportsQuery(api, ORG_ID, CLAIM_ID).refetchInterval as (query: {
          state: { data: unknown };
        }) => number | false
      )({ state: { data: reports } });
    const lookAtOne = (one: Schema<"ReportJobRead">) =>
      (
        reportQuery(api, ORG_ID, CLAIM_ID, one.id).refetchInterval as (query: {
          state: { data: unknown };
        }) => number | false
      )({ state: { data: one } });

    expect(look([report(OLD, "ready"), report(NEW, "queued")])).toBe(REPORT_POLL_MS);
    expect(look([report(OLD, "ready")])).toBe(LINK_REFRESH_MS);
    expect(look([report(OLD, "failed")])).toBe(false);
    expect(look([])).toBe(false);
    expect(lookAtOne(report(NEW, "queued"))).toBe(REPORT_POLL_MS);
    expect(LINK_REFRESH_MS).toBeLessThan(60 * 60_000); // download links last an hour
  });

  test("a request shows at once, queued, and becomes ready by polling", async () => {
    let made = false;
    let asked = 0;
    const server = new FakeServer()
      .on("GET", REPORTS, () => {
        asked += 1;
        if (!made) {
          return json([report(OLD, "ready")]);
        }
        // Queued on the first poll, ready on the next.
        return json([report(NEW, asked > 2 ? "ready" : "queued"), report(OLD, "ready")]);
      })
      .on("POST", REPORTS, () => {
        made = true;
        return json(report(NEW, "queued"), 202);
      });
    const { result } = renderWithApi(
      () => ({ list: useReports(ORG_ID, CLAIM_ID), request: useRequestReport(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    await act(() => result.current.request.mutateAsync("photo_report"));

    await waitFor(() => {
      expect(result.current.list.data?.map((r) => r.status)).toEqual(["queued", "ready"]);
    });
    expect(asked).toBe(1); // shown from the answer, not a refetch
    await waitFor(
      () => {
        expect(result.current.list.data?.[0]?.download_url).toContain(`${NEW}.pdf`);
      },
      { timeout: 3 * REPORT_POLL_MS },
    );
  });

  test("a deleted report leaves the list, its shares with it", async () => {
    const server = new FakeServer()
      .on("GET", REPORTS, () => json([report(OLD, "failed")]))
      .on("DELETE", `${REPORTS}/${OLD}`, noContent);
    const { result, queryClient } = renderWithApi(
      () => ({ list: useReports(ORG_ID, CLAIM_ID), remove: useDeleteReport(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    queryClient.setQueryData(queryKeys.reportShares(ORG_ID, CLAIM_ID, OLD), [share()]);

    await act(() => result.current.remove.mutateAsync(OLD));

    await waitFor(() => {
      expect(result.current.list.data).toEqual([]);
    });
    expect(queryClient.getQueryData(queryKeys.reportShares(ORG_ID, CLAIM_ID, OLD))).toBeUndefined();
  });
});

describe("sharing", () => {
  async function withShares<Mutation>(server: FakeServer, useMutation: () => Mutation) {
    const rendered = renderWithApi(
      () => ({ shares: useReportShares(ORG_ID, CLAIM_ID, OLD), change: useMutation() }),
      { server },
    );
    await waitFor(() => {
      expect(rendered.result.current.shares.data).toBeDefined();
    });
    return rendered;
  }

  test("the link comes back once and is never cached", async () => {
    const server = new FakeServer()
      .on("GET", `${REPORTS}/${OLD}/shares`, () => json([]))
      .on("POST", `${REPORTS}/${OLD}/shares`, () => json({ ...share(), url: SHARE_URL }, 201));
    const { result, queryClient } = await withShares(server, () =>
      useShareReport(ORG_ID, CLAIM_ID, OLD),
    );

    const created = await act(() =>
      result.current.change.mutateAsync({ label: "For the adjuster", expires_in_days: 7 }),
    );

    expect(created.url).toBe(SHARE_URL);
    await waitFor(() => {
      expect(result.current.shares.data).toEqual([share()]);
    });
    const cached = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => JSON.stringify(query.state.data));
    expect(cached.join()).not.toContain("s3cr3t");
  });

  test("a revoked link stays listed, inactive", async () => {
    const server = new FakeServer()
      .on("GET", `${REPORTS}/${OLD}/shares`, () => json([share()]))
      .on("POST", `${REPORTS}/${OLD}/shares/${SHARE}/revoke`, () => json(share(false)));
    const { result } = await withShares(server, () => useRevokeShare(ORG_ID, CLAIM_ID, OLD));

    await act(() => result.current.change.mutateAsync(SHARE));

    await waitFor(() => {
      expect(result.current.shares.data?.map((s) => s.active)).toEqual([false]);
    });
  });
});
