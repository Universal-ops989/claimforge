import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders an accessible button that defaults to type=button", () => {
    render(<Button>Save claim</Button>);

    const button = screen.getByRole("button", { name: "Save claim" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("root", "primary", "md");
  });

  it("calls onClick when pressed with mouse or keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Assign</Button>);

    await userEvent.click(screen.getByRole("button"));
    screen.getByRole("button").focus();
    await userEvent.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Delete
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("marks loading buttons busy and blocks interaction", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Generate report
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Generate report" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies variant, size and fullWidth classes", () => {
    render(
      <Button variant="danger" size="lg" fullWidth>
        Remove
      </Button>,
    );

    expect(screen.getByRole("button")).toHaveClass("danger", "lg", "fullWidth");
  });

  it("hides decorative icons from assistive tech", () => {
    render(<Button leadingIcon={<svg data-testid="icon" />}>Upload</Button>);

    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("renders its child with button styles when asChild is set", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/claims/42">Open claim</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Open claim" });
    expect(link).toHaveAttribute("href", "/claims/42");
    expect(link).toHaveClass("root", "secondary");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("allows submit buttons inside forms", () => {
    render(<Button type="submit">Submit</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
