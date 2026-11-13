import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Heading } from "./heading";

describe("Heading", () => {
  it("defaults to h2 with a matching size", () => {
    render(<Heading>Claims</Heading>);

    const heading = screen.getByRole("heading", { level: 2, name: "Claims" });
    expect(heading).toHaveClass("size-xl");
  });

  it("decouples semantic level from visual size", () => {
    render(
      <Heading level={1} size="md">
        Claim #1042
      </Heading>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("size-md");
  });
});
