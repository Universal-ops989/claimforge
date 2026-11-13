import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Stepper, type StepDefinition } from "./stepper";

const STEPS: StepDefinition[] = [
  { id: "policyholder", label: "Policyholder" },
  { id: "property", label: "Property" },
  { id: "loss", label: "Loss details" },
  { id: "review", label: "Review" },
];

describe("Stepper", () => {
  it("is an ordered list with the status in each step's name", () => {
    render(<Stepper steps={STEPS} current={2} label="New claim progress" />);

    const list = screen.getByRole("list", { name: "New claim progress" });
    expect(list.tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Policyholder, completed",
      "Property, completed",
      "3Loss details, current step",
      "4Review, not started",
    ]);
    expect(items[2]).toHaveAttribute("aria-current", "step");
  });

  it("lets users revisit completed steps but not upcoming ones", async () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={STEPS} current={2} onStepClick={onStepClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Property, completed" }));
    expect(onStepClick).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: /Review/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Loss details/ })).not.toBeInTheDocument();
  });

  it("flags steps with errors", () => {
    render(
      <Stepper
        steps={STEPS.map((s) => (s.id === "property" ? { ...s, error: true } : s))}
        current={3}
        onStepClick={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Property, needs attention" })).toBeInTheDocument();
  });
});
