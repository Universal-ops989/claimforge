import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RadioGroup, type RadioOption } from "./radio-group";

const CATEGORIES: RadioOption[] = [
  { value: "1", label: "Category 1", description: "Clean water source" },
  { value: "2", label: "Category 2" },
  { value: "3", label: "Category 3", disabled: true },
];

describe("RadioGroup", () => {
  it("is a labelled radiogroup", () => {
    render(<RadioGroup label="Water category" options={CATEGORIES} />);

    expect(screen.getByRole("radiogroup", { name: "Water category" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("selects an option by clicking its label", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup label="Water category" options={CATEGORIES} onValueChange={onValueChange} />,
    );

    await userEvent.click(screen.getByText("Category 2"));

    expect(screen.getByRole("radio", { name: "Category 2" })).toBeChecked();
    expect(onValueChange).toHaveBeenCalledWith("2");
  });

  it("moves selection with arrow keys and skips disabled options", async () => {
    render(<RadioGroup label="Water category" options={CATEGORIES} defaultValue="1" />);

    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Category 1" })).toHaveFocus();
    // Hold the key like a real press: Radix selects on the (deferred) focus move
    // only while the arrow key is still down.
    await userEvent.keyboard("{ArrowDown>}");
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Category 2" })).toBeChecked();
    });
    await userEvent.keyboard("{/ArrowDown}");
    expect(screen.getByRole("radio", { name: "Category 3" })).toBeDisabled();
  });

  it("links option descriptions", () => {
    render(<RadioGroup label="Water category" options={CATEGORIES} />);

    expect(screen.getByRole("radio", { name: "Category 1" })).toHaveAccessibleDescription(
      "Clean water source",
    );
  });

  it("keeps a hidden label accessible", () => {
    render(<RadioGroup label="Loss type" hideLabel options={CATEGORIES} />);

    expect(screen.getByRole("radiogroup", { name: "Loss type" })).toBeInTheDocument();
  });

  it("marks the group invalid", () => {
    render(<RadioGroup label="Loss type" options={CATEGORIES} invalid />);

    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
  });
});
