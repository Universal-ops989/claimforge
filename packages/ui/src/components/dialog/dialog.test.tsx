import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";

function AddRoomDialog(props: {
  disableOutsideClose?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={props.onOpenChange}>
      <DialogTrigger asChild>
        <Button>Add room</Button>
      </DialogTrigger>
      <DialogContent
        title="Add room"
        description="Rooms group readings, photos and line items."
        disableOutsideClose={props.disableOutsideClose}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button>Save</Button>
          </>
        }
      >
        <label>
          Room name <input />
        </label>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("opens from the trigger as a labelled, described modal", async () => {
    render(<AddRoomDialog />);

    await userEvent.click(screen.getByRole("button", { name: "Add room" }));

    const dialog = screen.getByRole("dialog", { name: "Add room" });
    expect(dialog).toHaveAccessibleDescription("Rooms group readings, photos and line items.");
  });

  it("moves focus into the dialog and restores it on close", async () => {
    render(<AddRoomDialog />);
    const trigger = screen.getByRole("button", { name: "Add room" });

    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("keeps Tab focus inside the dialog", async () => {
    render(<AddRoomDialog />);
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));
    const dialog = screen.getByRole("dialog");

    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("closes from the close button and DialogClose", async () => {
    const onOpenChange = vi.fn();
    render(<AddRoomDialog onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Add room" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await userEvent.click(screen.getByRole("button", { name: "Add room" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  // The modal sets pointer-events: none on <body>; a real outside click still lands,
  // so skip user-event's pointer-events check to simulate it.
  const outsideClicker = () => userEvent.setup({ pointerEventsCheck: 0 });

  it("closes on outside click by default", async () => {
    const onOpenChange = vi.fn();
    render(<AddRoomDialog onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));

    await outsideClicker().click(document.body);

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("can ignore outside clicks", async () => {
    const onOpenChange = vi.fn();
    render(<AddRoomDialog disableOutsideClose onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));
    onOpenChange.mockClear();

    await outsideClicker().click(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
