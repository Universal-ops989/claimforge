import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisuallyHidden } from "./visually-hidden";

describe("VisuallyHidden", () => {
  it("keeps content in the accessibility tree", () => {
    render(
      <button type="button">
        <VisuallyHidden>Close dialog</VisuallyHidden>
      </button>,
    );

    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });

  it("merges custom class names", () => {
    render(<VisuallyHidden className="extra">Hidden</VisuallyHidden>);

    expect(screen.getByText("Hidden")).toHaveClass("root", "extra");
  });
});
