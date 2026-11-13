import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button/button";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("shows on keyboard focus and describes the trigger", async () => {
    render(
      <Tooltip content="Grains per pound: absolute humidity" delay={0}>
        <Button>GPP</Button>
      </Tooltip>,
    );

    await userEvent.tab();

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Grains per pound: absolute humidity");
    expect(screen.getByRole("button", { name: "GPP" })).toHaveAccessibleDescription(
      "Grains per pound: absolute humidity",
    );
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <Tooltip content="Hint" delay={0} onOpenChange={onOpenChange}>
        <Button>Target</Button>
      </Tooltip>,
    );

    await userEvent.tab();
    await screen.findByRole("tooltip");
    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
