import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createColumnHelper, DataTable } from "./data-table";

interface Claim {
  id: string;
  insured: string;
  amount: number;
}

const CLAIMS: Claim[] = [
  { id: "CF-1042", insured: "Rivera", amount: 18_400 },
  { id: "CF-1043", insured: "Chen", amount: 4_250 },
  { id: "CF-1044", insured: "Abbott", amount: 9_900 },
];

const col = createColumnHelper<Claim>();
const COLUMNS = [
  col.accessor("id", {
    header: "Claim",
    cell: (info) => <a href={`/claims/${info.getValue()}`}>{info.getValue()}</a>,
  }),
  col.accessor("insured", { header: "Insured" }),
  col.accessor("amount", { header: "Amount", meta: { align: "end" } }),
];

const bodyRows = () => screen.getAllByRole("row").slice(1);
const firstCells = () => bodyRows().map((row) => within(row).getAllByRole("cell")[0]?.textContent);

describe("DataTable", () => {
  it("renders a captioned table with column headers", () => {
    render(<DataTable caption="Open claims" data={CLAIMS} columns={COLUMNS} />);

    expect(screen.getByRole("table", { name: "Open claims" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Claim",
      "Insured",
      "Amount",
    ]);
    expect(bodyRows()).toHaveLength(3);
  });

  it("sorts by a column and exposes aria-sort", async () => {
    render(<DataTable caption="Claims" data={CLAIMS} columns={COLUMNS} />);

    await userEvent.click(screen.getByRole("button", { name: "Insured" }));
    expect(screen.getByRole("columnheader", { name: "Insured" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(firstCells()).toEqual(["CF-1044", "CF-1043", "CF-1042"]);

    await userEvent.click(screen.getByRole("button", { name: "Insured" }));
    expect(screen.getByRole("columnheader", { name: "Insured" })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("reports sort changes without reordering in manual mode", async () => {
    const onSortingChange = vi.fn();
    render(
      <DataTable
        caption="Claims"
        data={CLAIMS}
        columns={COLUMNS}
        manualSorting
        sorting={[]}
        onSortingChange={onSortingChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Amount" }));

    expect(onSortingChange).toHaveBeenCalledOnce();
    expect(firstCells()).toEqual(["CF-1042", "CF-1043", "CF-1044"]);
  });

  it("selects rows individually and all at once", async () => {
    render(
      <DataTable
        caption="Claims"
        data={CLAIMS}
        columns={COLUMNS}
        enableRowSelection
        getRowId={(c) => c.id}
        getRowLabel={(c) => c.id}
      />,
    );

    const selectAll = screen.getByRole("checkbox", { name: "Select all rows" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select CF-1043" }));
    expect(selectAll).toHaveAttribute("aria-checked", "mixed");

    await userEvent.click(selectAll);
    for (const box of screen.getAllByRole("checkbox", { name: /^Select CF-/ })) {
      expect(box).toBeChecked();
    }
  });

  it("calls onRowClick but not when clicking controls inside the row", async () => {
    const onRowClick = vi.fn();
    render(<DataTable caption="Claims" data={CLAIMS} columns={COLUMNS} onRowClick={onRowClick} />);

    await userEvent.click(screen.getByText("Chen"));
    expect(onRowClick).toHaveBeenCalledWith(CLAIMS[1]);

    onRowClick.mockClear();
    await userEvent.click(screen.getByRole("link", { name: "CF-1042" }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("shows loading and empty states", () => {
    const { rerender } = render(
      <DataTable caption="Claims" data={[]} columns={COLUMNS} loading loadingRows={2} />,
    );
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(bodyRows()).toHaveLength(2);

    rerender(
      <DataTable caption="Claims" data={[]} columns={COLUMNS} emptyState="No claims match" />,
    );
    expect(screen.getByRole("cell", { name: "No claims match" })).toHaveAttribute("colspan", "3");
  });
});
