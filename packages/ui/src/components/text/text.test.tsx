import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Text } from "./text";

describe("Text", () => {
  it("renders a span with default styles", () => {
    render(<Text>Water loss</Text>);

    const el = screen.getByText("Water loss");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("size-md", "weight-regular", "tone-default");
  });

  it("renders the requested element and modifiers", () => {
    render(
      <Text as="p" size="sm" weight="semibold" tone="danger" truncate numeric>
        42.5%
      </Text>,
    );

    const el = screen.getByText("42.5%");
    expect(el.tagName).toBe("P");
    expect(el).toHaveClass("size-sm", "weight-semibold", "tone-danger", "truncate", "numeric");
  });

  it("clamps to a number of lines", () => {
    render(<Text lineClamp={2}>Long note</Text>);

    const el = screen.getByText("Long note");
    expect(el).toHaveClass("clamp");
    expect(el.style.webkitLineClamp).toBe("2");
  });

  it("works as a form label", () => {
    render(
      <>
        <Text as="label" htmlFor="policy">
          Policy number
        </Text>
        <input id="policy" />
      </>,
    );

    expect(screen.getByLabelText("Policy number")).toBeInTheDocument();
  });
});
