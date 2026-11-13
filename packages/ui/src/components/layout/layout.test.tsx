import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Grid, Inline, Stack } from "./layout";

describe("Stack", () => {
  it("sets gap and alignment through CSS variables", () => {
    render(
      <Stack data-testid="stack" gap={6} align="center" justify="between">
        <div />
      </Stack>,
    );

    const el = screen.getByTestId("stack");
    expect(el).toHaveClass("stack");
    expect(el.style.getPropertyValue("--layout-gap")).toBe("var(--cf-space-6)");
    expect(el.style.getPropertyValue("--layout-align")).toBe("center");
    expect(el.style.getPropertyValue("--layout-justify")).toBe("space-between");
  });

  it("renders semantic list elements and merges user styles", () => {
    render(
      <Stack as="ul" style={{ maxWidth: 200 }}>
        <li>Kitchen</li>
      </Stack>,
    );

    const list = screen.getByRole("list");
    expect(list.style.maxWidth).toBe("200px");
    expect(screen.getByRole("listitem")).toHaveTextContent("Kitchen");
  });
});

describe("Inline", () => {
  it("wraps by default and can opt out", () => {
    const { rerender } = render(<Inline data-testid="row" />);
    expect(screen.getByTestId("row")).not.toHaveClass("nowrap");

    rerender(<Inline data-testid="row" wrap={false} />);
    expect(screen.getByTestId("row")).toHaveClass("nowrap");
  });
});

describe("Grid", () => {
  it("uses a fixed column count", () => {
    render(<Grid data-testid="grid" columns={3} />);

    expect(screen.getByTestId("grid").style.getPropertyValue("--layout-columns")).toBe(
      "repeat(3, minmax(0, 1fr))",
    );
  });

  it("uses responsive auto-fill columns from minChildWidth", () => {
    render(<Grid data-testid="grid" minChildWidth="12rem" />);

    expect(screen.getByTestId("grid").style.getPropertyValue("--layout-columns")).toBe(
      "repeat(auto-fill, minmax(min(12rem, 100%), 1fr))",
    );
  });
});
