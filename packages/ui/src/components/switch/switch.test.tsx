import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("is a labelled switch that toggles on click", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Email notifications" onCheckedChange={onCheckedChange} />);

    const control = screen.getByRole("switch", { name: "Email notifications" });
    expect(control).not.toBeChecked();

    await userEvent.click(screen.getByText("Email notifications"));

    expect(control).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("toggles with the keyboard", async () => {
    render(<Switch label="Auto-assign" defaultChecked />);

    screen.getByRole("switch").focus();
    await userEvent.keyboard(" ");

    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("links the description", () => {
    render(<Switch label="Daily digest" description="Sent at 7:00 am local time" />);

    expect(screen.getByRole("switch")).toHaveAccessibleDescription("Sent at 7:00 am local time");
  });

  it("respects disabled", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Locked" disabled onCheckedChange={onCheckedChange} />);

    await userEvent.click(screen.getByRole("switch"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("supports label-first layout", () => {
    render(<Switch label="Dark mode" labelPosition="start" />);

    expect(screen.getByRole("switch").parentElement).toHaveClass("labelStart");
  });
});
