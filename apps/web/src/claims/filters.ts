import type { QueryParams } from "@claimforge/api-client";

import { LOSS_TYPE_LABEL, STATUS_LABEL, type ClaimStatus, type LossType } from "./status";

/** What the claims list is narrowed to. */
export interface ClaimFilters {
  status: ClaimStatus[];
  lossType: LossType[];
  /** Free text the API matches against numbers, carrier, policy, address and contacts. */
  q: string;
}

export type ClaimsQuery = Omit<
  QueryParams<"/v1/organizations/{organization_id}/claims", "get">,
  "cursor"
>;

export const NO_FILTERS: ClaimFilters = { status: [], lossType: [], q: "" };

const STATUSES = Object.keys(STATUS_LABEL) as ClaimStatus[];
const LOSS_TYPES = Object.keys(LOSS_TYPE_LABEL) as LossType[];

const known = <Value extends string>(values: string[], allowed: Value[]): Value[] =>
  allowed.filter((value) => values.includes(value));

/** The filters in an address. Unknown values are dropped, so no link can break the query. */
export function readFilters(params: URLSearchParams): ClaimFilters {
  return {
    status: known(params.getAll("status"), STATUSES),
    lossType: known(params.getAll("loss_type"), LOSS_TYPES),
    q: (params.get("q") ?? "").trim(),
  };
}

/** `params` with `filters` written in; other parameters (the sort, say) stay. */
export function writeFilters(params: URLSearchParams, filters: ClaimFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("status");
  next.delete("loss_type");
  next.delete("q");
  for (const status of filters.status) next.append("status", status);
  for (const lossType of filters.lossType) next.append("loss_type", lossType);
  if (filters.q) next.set("q", filters.q);
  return next;
}

export function hasFilters(filters: ClaimFilters): boolean {
  return filters.status.length > 0 || filters.lossType.length > 0 || filters.q !== "";
}

/** The API query for `filters`; empty filters are left out. */
export function filtersQuery(filters: ClaimFilters): ClaimsQuery {
  return {
    ...(filters.status.length ? { status: filters.status } : {}),
    ...(filters.lossType.length ? { loss_type: filters.lossType } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}
