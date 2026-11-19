import { ids } from "@claimforge/api-client/fixtures";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import type { LogPoint } from "../moisture";
import { DryingChart, series, ticks } from "./drying-chart";

const visits = ["2026-11-14T15:00:00Z", "2026-11-15T15:00:00Z", "2026-11-16T15:00:00Z"].map(
  (taken_at, i) => ({ id: `v${String(i)}`, taken_at, taken_by: null }),
);

function point(changes: Partial<LogPoint> = {}): LogPoint {
  return {
    id: ids.point,
    label: "1",
    material: "drywall",
    surface: "wall",
    scale: "percent",
    dry_standard: 12,
    dry_standard_basis: "reference",
    status: "drying",
    dried_at: null,
    values: [28, null, 18],
    ...changes,
  };
}

describe("the chart's numbers", () => {
  test("ticks are round, from 0 to just past the top", () => {
    expect(ticks(32)).toEqual([0, 20, 40]);
    expect(ticks(9)).toEqual([0, 5, 10]);
    expect(ticks(115)).toEqual([0, 50, 100, 150]);
  });

  test("series keeps the visits that read the point", () => {
    expect(series(point(), visits)).toEqual([
      { at: "2026-11-14T15:00:00Z", value: 28 },
      { at: "2026-11-16T15:00:00Z", value: 18 },
    ]);
  });
});

describe("the drying chart", () => {
  test("says what it shows, for screen readers", () => {
    render(<DryingChart point={point()} visits={visits} />);

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Point 1: 28% on Nov 14, 18% on Nov 16; dry at 12% or less. Drying.",
    );
    expect(screen.getByText("Goal 12%")).toBeInTheDocument();
  });

  test("shows the same numbers as a table on request", async () => {
    const user = userEvent.setup();
    render(<DryingChart point={point()} visits={visits} />);

    await user.click(screen.getByRole("button", { name: "Show the numbers" }));

    const rows = within(screen.getByRole("table", { name: "Point 1 readings" })).getAllByRole(
      "row",
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      "VisitReadingDry?",
      "Nov 1428%No",
      "Nov 1618%No",
    ]);
    expect(screen.getByRole("button", { name: "Hide the numbers" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  test("hovering finds the nearest visit", () => {
    render(<DryingChart point={point({ values: [28, 22, 18] })} visits={visits} />);
    const chart = screen.getByRole("img");
    chart.getBoundingClientRect = () => ({ left: 0, width: 360, top: 0, height: 168 }) as DOMRect;

    fireEvent.pointerMove(chart, { clientX: 200 });

    expect(screen.getByText("Nov 15: 22%")).toBeInTheDocument();
    fireEvent.pointerLeave(chart);
    expect(screen.queryByText("Nov 15: 22%")).not.toBeInTheDocument();
  });

  test("a point without a goal says so; one not read has no chart", () => {
    const { container } = render(
      <>
        <DryingChart point={point({ dry_standard: null, status: "no_goal" })} visits={visits} />
        <DryingChart
          point={point({ id: "p2", label: "2", values: [null, null, null] })}
          visits={visits}
        />
      </>,
    );

    expect(screen.getByRole("img")).toHaveAccessibleName(/; no goal\. No goal\.$/);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });
});
