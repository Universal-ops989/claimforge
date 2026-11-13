import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "./menu";

function ClaimActions({
  onAssign,
  onDelete,
  onToggle,
}: {
  onAssign?: () => void;
  onDelete?: () => void;
  onToggle?: (checked: boolean) => void;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button>Actions</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Claim</MenuLabel>
        <MenuItem onSelect={onAssign} shortcut="A">
          Assign
        </MenuItem>
        <MenuItem disabled>Duplicate</MenuItem>
        <MenuItem>Export</MenuItem>
        <MenuCheckboxItem checked onCheckedChange={onToggle}>
          Show closed claims
        </MenuCheckboxItem>
        <MenuSeparator />
        <MenuItem tone="danger" onSelect={onDelete}>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

describe("Menu", () => {
  it("opens a menu of items", async () => {
    render(<ClaimActions />);

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("selects an item and returns focus to the trigger", async () => {
    const onAssign = vi.fn();
    render(<ClaimActions onAssign={onAssign} />);
    const trigger = screen.getByRole("button", { name: "Actions" });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitem", { name: "Assign" }));

    expect(onAssign).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("supports keyboard navigation and selection", async () => {
    const onDelete = vi.fn();
    render(<ClaimActions onDelete={onDelete} />);

    screen.getByRole("button", { name: "Actions" }).focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("menu");
    await userEvent.keyboard("{End}{Enter}");

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("toggles checkbox items", async () => {
    const onToggle = vi.fn();
    render(<ClaimActions onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    const item = screen.getByRole("menuitemcheckbox", { name: "Show closed claims" });
    expect(item).toBeChecked();
    await userEvent.click(item);

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("closes on Escape", async () => {
    render(<ClaimActions />);

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
