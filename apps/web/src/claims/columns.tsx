import type { Schema } from "@claimforge/api-client";
import { Badge, createColumnHelper, Text } from "@claimforge/ui";
import { Link } from "react-router";

import { calendarDate } from "../format/calendar-date";
import { fullTime, relativeTime } from "../format/relative-time";
import { LOSS_TYPE_LABEL, STATUS_LABEL, STATUS_TONE } from "./status";

export type ClaimRow = Schema<"ClaimSummary">;

const column = createColumnHelper<ClaimRow>();

/**
 * The claims table's columns; `claimPath` gives a claim's address in this organization.
 * Headers don't sort: the API sorts (the sort menu), and sorting only the loaded page of
 * a paged list would mislead.
 */
export function claimColumns(claimPath: (number: string) => string, now: Date) {
  const columns = [
    column.accessor("number", {
      header: "Claim",
      cell: ({ getValue }) => <Link to={claimPath(getValue())}>{getValue()}</Link>,
      meta: { width: "8rem" },
    }),
    column.accessor("status", {
      header: "Status",
      cell: ({ getValue }) => (
        <Badge tone={STATUS_TONE[getValue()]} size="sm">
          {STATUS_LABEL[getValue()]}
        </Badge>
      ),
      meta: { width: "8rem" },
    }),
    column.accessor("loss_type", {
      header: "Loss",
      cell: ({ getValue }) => LOSS_TYPE_LABEL[getValue()],
      meta: { width: "7rem" },
    }),
    column.accessor((claim) => claim.property.address.formatted, {
      id: "address",
      header: "Property",
      cell: ({ getValue }) => <Text truncate>{getValue()}</Text>,
    }),
    column.accessor("loss_date", {
      header: "Date of loss",
      cell: ({ getValue }) => {
        const date = getValue();
        return date ? calendarDate(date) : <Text tone="subtle">Not given</Text>;
      },
      meta: { width: "9rem" },
    }),
    column.accessor((claim) => claim.adjuster?.full_name ?? null, {
      id: "adjuster",
      header: "Adjuster",
      cell: ({ getValue }) => getValue() ?? <Text tone="subtle">Unassigned</Text>,
      meta: { width: "10rem" },
    }),
    column.accessor("updated_at", {
      header: "Updated",
      cell: ({ getValue }) => (
        <time dateTime={getValue()} title={fullTime(getValue())}>
          {relativeTime(getValue(), now)}
        </time>
      ),
      meta: { width: "8rem", align: "end" },
    }),
  ];
  return columns.map((definition) => ({ ...definition, enableSorting: false }));
}
