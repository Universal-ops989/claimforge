import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./checkbox";
import { CheckboxGroup } from "./checkbox-group";

describe("Checkbox", () => {
  it("toggles when the label is clicked", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Asbestos suspected" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Asbestos suspected" });
    expect(checkbox).not.toBeChecked();

    await userEvent.click(screen.getByText("Asbestos suspected"));

    expect(checkbox).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("toggles with the space key", async () => {
    render(<Checkbox label="Photos taken" />);

    screen.getByRole("checkbox").focus();
    await userEvent.keyboard(" ");

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("exposes the indeterminate state as mixed", () => {
    render(<Checkbox aria-label="Select all rooms" checked="indeterminate" />);

    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  });

  it("describes itself with the description text", () => {
    render(<Checkbox label="Pre-existing damage" description="Noted before the loss date" />);

    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription("Noted before the loss date");
  });

  it("does not toggle when disabled", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Locked" disabled onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe("CheckboxGroup", () => {
  const AREAS = [
    { value: "ceiling", label: "Ceiling" },
    { value: "walls", label: "Walls" },
    { value: "floor", label: "Floor" },
  ];

  it("renders a labelled group and reports values in option order", async () => {
    const onValueChange = vi.fn();
    render(<CheckboxGroup label="Affected areas" options={AREAS} onValueChange={onValueChange} />);

    expect(screen.getByRole("group", { name: "Affected areas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Floor" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Ceiling" }));

    expect(onValueChange).toHaveBeenLastCalledWith(["ceiling", "floor"]);
  });

  it("supports controlled values and unchecking", async () => {
    const onValueChange = vi.fn();
    render(
      <CheckboxGroup
        label="Affected areas"
        options={AREAS}
        value={["walls"]}
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Walls" })).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "Walls" }));

    expect(onValueChange).toHaveBeenCalledWith([]);
  });

  it("disables every option when the group is disabled", () => {
    render(<CheckboxGroup label="Affected areas" options={AREAS} disabled />);

    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
    }
  });
});
