import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton, SkeletonText } from "../skeleton/skeleton";
import { Spinner } from "../spinner/spinner";
import { EmptyState } from "./empty-state";

describe("Spinner", () => {
  it("is a labelled status by default", () => {
    render(<Spinner label="Loading readings" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading readings");
  });

  it("is decorative when label is null", () => {
    render(<Spinner label={null} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech and accepts sizes", () => {
    const { container } = render(<Skeleton shape="circle" height={40} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.style.width).toBe("40px");
    expect(el.style.height).toBe("40px");
  });

  it("renders paragraph lines with a shorter last line", () => {
    const { container } = render(<SkeletonText lines={3} />);
    const lines = container.querySelectorAll(".text");

    expect(lines).toHaveLength(3);
    expect((lines[2] as HTMLElement).style.width).toBe("60%");
  });
});

describe("EmptyState", () => {
  it("renders a heading, description and actions", () => {
    render(
      <EmptyState
        title="No claims yet"
        description="Create a claim to start documenting a loss."
        actions={<button type="button">New claim</button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "No claims yet" })).toBeInTheDocument();
    expect(screen.getByText("Create a claim to start documenting a loss.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New claim" })).toBeInTheDocument();
  });
});
