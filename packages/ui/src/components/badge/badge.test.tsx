import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, StatusPill } from "./badge";

describe("Badge", () => {
  it("renders text with default tone, emphasis and size", () => {
    render(<Badge>12 photos</Badge>);

    expect(screen.getByText("12 photos")).toHaveClass("root", "neutral", "subtle", "md");
  });

  it("applies tone, emphasis and size", () => {
    render(
      <Badge tone="danger" emphasis="solid" size="sm">
        Cat 3
      </Badge>,
    );

    expect(screen.getByText("Cat 3")).toHaveClass("danger", "solid", "sm");
  });

  it("hides decorative icons", () => {
    render(<Badge icon={<svg data-testid="icon" />}>Mold</Badge>);

    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("StatusPill", () => {
  it("shows a status dot next to the text", () => {
    render(
      <StatusPill tone="info" pulse>
        Drying in progress
      </StatusPill>,
    );

    const pill = screen.getByText("Drying in progress");
    expect(pill).toHaveClass("pill", "info");
    expect(pill.querySelector(".dot")).toHaveClass("pulse");
  });
});
