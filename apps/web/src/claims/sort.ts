import type { ClaimsQuery } from "./filters";

export type ClaimSort = NonNullable<ClaimsQuery["sort"]>;

/** The orders the API can list claims in, as the sort menu offers them. */
export const SORTS: { value: ClaimSort; label: string }[] = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "-updated_at", label: "Recently updated" },
  { value: "-loss_date", label: "Date of loss, newest first" },
  { value: "loss_date", label: "Date of loss, oldest first" },
];

export const DEFAULT_SORT: ClaimSort = "-created_at";

/** The sort in an address; anything unknown reads as the default. */
export function readSort(params: URLSearchParams): ClaimSort {
  const asked = params.get("sort");
  return SORTS.find((sort) => sort.value === asked)?.value ?? DEFAULT_SORT;
}

/** `params` with `sort` written in; the default is left out, keeping addresses short. */
export function writeSort(params: URLSearchParams, sort: ClaimSort): URLSearchParams {
  const next = new URLSearchParams(params);
  if (sort === DEFAULT_SORT) next.delete("sort");
  else next.set("sort", sort);
  return next;
}
