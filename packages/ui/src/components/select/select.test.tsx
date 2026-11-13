import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select, type SelectProps } from "./select";

const LOSS_TYPES: SelectProps["options"] = [
  { value: "water", label: "Water" },
  { value: "fire", label: "Fire" },
  { value: "mold", label: "Mold", disabled: true },
];

describe("Select", () => {
  it("shows the placeholder until a value is chosen", () => {
    render(<Select aria-label="Loss type" options={LOSS_TYPES} placeholder="Choose loss type" />);

    expect(screen.getByRole("combobox", { name: "Loss type" })).toHaveTextContent(
      "Choose loss type",
    );
  });

  it("selects an option with the mouse", async () => {
    const onValueChange = vi.fn();
    render(<Select aria-label="Loss type" options={LOSS_TYPES} onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Fire" }));

    expect(onValueChange).toHaveBeenCalledWith("fire");
    expect(screen.getByRole("combobox")).toHaveTextContent("Fire");
  });

  it("supports keyboard selection", async () => {
    const onValueChange = vi.fn();
    render(<Select aria-label="Loss type" options={LOSS_TYPES} onValueChange={onValueChange} />);

    screen.getByRole("combobox").focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onValueChange).toHaveBeenCalledWith("fire");
  });

  it("marks disabled options", async () => {
    render(<Select aria-label="Loss type" options={LOSS_TYPES} />);

    await userEvent.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Mold" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("renders option groups with labels", async () => {
    render(
      <Select
        aria-label="Status"
        options={[
          { label: "Open", options: [{ value: "new", label: "New" }] },
          { label: "Closed", options: [{ value: "paid", label: "Paid" }] },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Closed")).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it("reflects invalid and disabled state on the trigger", () => {
    render(<Select aria-label="Loss type" options={LOSS_TYPES} invalid disabled />);

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toBeDisabled();
  });
});
