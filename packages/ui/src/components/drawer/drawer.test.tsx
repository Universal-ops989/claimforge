import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "../button/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "./drawer";

function ClaimPreview({ side }: { side?: "left" | "right" }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Preview claim</Button>
      </DrawerTrigger>
      <DrawerContent
        title="Claim CF-1042"
        description="1428 Maple Grove Dr"
        side={side}
        headerActions={<Button size="sm">Open</Button>}
        footer={
          <DrawerClose asChild>
            <Button variant="secondary">Done</Button>
          </DrawerClose>
        }
      >
        Details
      </DrawerContent>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("opens as a named dialog on the requested side", async () => {
    render(<ClaimPreview side="left" />);

    await userEvent.click(screen.getByRole("button", { name: "Preview claim" }));

    const drawer = screen.getByRole("dialog", { name: "Claim CF-1042" });
    expect(drawer).toHaveClass("left", "md");
    expect(drawer).toHaveAccessibleDescription("1428 Maple Grove Dr");
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    render(<ClaimPreview />);
    const trigger = screen.getByRole("button", { name: "Preview claim" });

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("closes from footer actions", async () => {
    render(<ClaimPreview />);

    await userEvent.click(screen.getByRole("button", { name: "Preview claim" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
