/**
 * Reports (PDFs made in the background) and the links that share them with people outside
 * the organization.
 *
 * A request is answered at once with a `queued` job; while any report shown is queued its
 * list or detail asks again every `REPORT_POLL_MS` until it's `ready` or `failed`. A ready
 * report's `download_url` lives an hour, so while one is shown it's refreshed every
 * `LINK_REFRESH_MS`, before the link dies.
 *
 * A share's `url` is in the answer to creating it and nowhere else: it's a credential,
 * shown once. `useShareReport` returns it; the cached share list keeps shares without it.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { Schema } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";

type Report = Schema<"ReportJobRead">;
type Share = Schema<"ShareRead">;

const REPORTS = "/v1/organizations/{organization_id}/claims/{claim_id}/reports";
const REPORT = `${REPORTS}/{job_id}` as const;
const SHARES = `${REPORT}/shares` as const;
const REVOKE = `${SHARES}/{share_id}/revoke` as const;

/** How often a queued report is asked about. */
export const REPORT_POLL_MS = 2_000;
/** How often ready reports are refetched for fresh download links (they last an hour). */
export const LINK_REFRESH_MS = 50 * 60_000;

/** How soon to ask again, given the reports shown. */
function nextLook(reports: readonly Report[] | undefined): number | false {
  if (reports?.some((report) => report.status === "queued")) {
    return REPORT_POLL_MS;
  }
  return reports?.some((report) => report.status === "ready") ? LINK_REFRESH_MS : false;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** A claim's reports, newest first. */
export function reportsQuery(api: ApiClient, organizationId: string, claimId: string) {
  return queryOptions({
    queryKey: queryKeys.reportList(organizationId, claimId),
    queryFn: ({ signal }) =>
      api.get(REPORTS, { path: { organization_id: organizationId, claim_id: claimId }, signal }),
    refetchInterval: ({ state }) => nextLook(state.data),
  });
}

export function useReports(organizationId: string, claimId: string) {
  return useQuery(reportsQuery(useApi(), organizationId, claimId));
}

export function reportQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  reportId: string,
) {
  return queryOptions({
    queryKey: queryKeys.report(organizationId, claimId, reportId),
    queryFn: ({ signal }) =>
      api.get(REPORT, {
        path: { organization_id: organizationId, claim_id: claimId, job_id: reportId },
        signal,
      }),
    refetchInterval: ({ state }) => nextLook(state.data && [state.data]),
  });
}

export function useReport(organizationId: string, claimId: string, reportId: string) {
  return useQuery(reportQuery(useApi(), organizationId, claimId, reportId));
}

/** A report's share links, newest first, revoked and expired ones included. */
export function reportSharesQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  reportId: string,
) {
  return queryOptions({
    queryKey: queryKeys.reportShares(organizationId, claimId, reportId),
    queryFn: ({ signal }) =>
      api.get(SHARES, {
        path: { organization_id: organizationId, claim_id: claimId, job_id: reportId },
        signal,
      }),
  });
}

export function useReportShares(organizationId: string, claimId: string, reportId: string) {
  return useQuery(reportSharesQuery(useApi(), organizationId, claimId, reportId));
}

// ─── Reports ─────────────────────────────────────────────────────────────────

function editReports(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  edit: (reports: Report[]) => Report[],
): void {
  queryClient.setQueryData<Report[]>(
    queryKeys.reportList(organizationId, claimId),
    (reports) => reports && edit(reports),
  );
}

/** Ask for a report: `mutate("photo_report")`. It shows at once, queued. */
export function useRequestReport(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kind: Schema<"ReportKind">) =>
      api.post(REPORTS, {
        path: { organization_id: organizationId, claim_id: claimId },
        body: { kind },
      }),
    onSuccess: async (queued) => {
      queryClient.setQueryData<Report>(
        queryKeys.report(organizationId, claimId, queued.id),
        queued,
      );
      editReports(queryClient, organizationId, claimId, (reports) => [
        queued,
        ...reports.filter((report) => report.id !== queued.id),
      ]);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.timelines(organizationId, claimId),
      });
    },
  });
}

/** Delete a report; its share links stop working. */
export function useDeleteReport(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) =>
      api.delete(REPORT, {
        path: { organization_id: organizationId, claim_id: claimId, job_id: reportId },
      }),
    onSuccess: async (_, reportId) => {
      const everything = { queryKey: queryKeys.report(organizationId, claimId, reportId) };
      await queryClient.cancelQueries(everything);
      queryClient.removeQueries(everything);
      editReports(queryClient, organizationId, claimId, (reports) =>
        reports.filter((report) => report.id !== reportId),
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.timelines(organizationId, claimId),
      });
    },
  });
}

// ─── Shares ──────────────────────────────────────────────────────────────────

/** A share as listed: everything the API answered except the URL. */
function withoutUrl({ url: _url, ...share }: Schema<"ShareCreated">): Share {
  return share;
}

/**
 * Make a share link for a ready report (409 `report_not_ready` otherwise). The answer's
 * `url` is the only copy there will be: show it, or copy it, now.
 */
export function useShareReport(organizationId: string, claimId: string, reportId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Schema<"ShareCreate"> = {}) =>
      api.post(SHARES, {
        path: { organization_id: organizationId, claim_id: claimId, job_id: reportId },
        body,
      }),
    onSuccess: async (created) => {
      queryClient.setQueryData<Share[]>(
        queryKeys.reportShares(organizationId, claimId, reportId),
        (shares) => shares && [withoutUrl(created), ...shares],
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.timelines(organizationId, claimId),
      });
    },
  });
}

/** Stop a share link working. The share stays listed, inactive. */
export function useRevokeShare(organizationId: string, claimId: string, reportId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) =>
      api.post(REVOKE, {
        path: {
          organization_id: organizationId,
          claim_id: claimId,
          job_id: reportId,
          share_id: shareId,
        },
      }),
    onSuccess: async (revoked) => {
      queryClient.setQueryData<Share[]>(
        queryKeys.reportShares(organizationId, claimId, reportId),
        (shares) => shares?.map((share) => (share.id === revoked.id ? revoked : share)),
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.timelines(organizationId, claimId),
      });
    },
  });
}
