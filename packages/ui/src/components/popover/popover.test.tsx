import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Button } from "../button/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover", () => {
  function AssignPopover() {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button>Assign</Button>
        </PopoverTrigger>
        <PopoverContent title="Assign technician" showCloseButton>
          <label>
            Search <input />
          </label>
          <PopoverClose asChild>
            <Button>Done</Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    );
  }

  it("opens a dialog named by its title and moves focus inside", async () => {
    render(<AssignPopover />);

    await userEvent.click(screen.getByRole("button", { name: "Assign" }));

    const popover = screen.getByRole("dialog", { name: "Assign technician" });
    expect(popover).toContainElement(document.activeElement as HTMLElement);
  });

  it("returns focus to the trigger when closed", async () => {
    render(<AssignPopover />);
    const trigger = screen.getByRole("button", { name: "Assign" });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("uses aria-label when there is no title", async () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Info</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Reading details">Details</PopoverContent>
      </Popover>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Info" }));

    expect(screen.getByRole("dialog", { name: "Reading details" })).toBeInTheDocument();
  });
});
