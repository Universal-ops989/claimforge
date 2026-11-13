import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { FieldContext, type FieldContextValue } from "../field/field-context";
import { Input } from "./input";

describe("Input", () => {
  it("accepts typing and reports changes", async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Policy number" onChange={onChange} />);

    await userEvent.type(screen.getByRole("textbox", { name: "Policy number" }), "HO-123");

    expect(screen.getByRole("textbox")).toHaveValue("HO-123");
    expect(onChange).toHaveBeenCalledTimes(6);
  });

  it("forwards the ref to the native input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Name" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("marks invalid inputs for assistive tech", () => {
    render(<Input aria-label="Email" invalid />);

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox").parentElement).toHaveClass("invalid");
  });

  it("renders decorative prefix and suffix", () => {
    render(<Input aria-label="Affected area" prefix="~" suffix="sq ft" />);

    expect(screen.getByText("sq ft")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("textbox", { name: "Affected area" })).toBeInTheDocument();
  });

  it("inherits id, description, error and state from a surrounding field", () => {
    const field: FieldContextValue = {
      id: "deductible",
      descriptionId: "deductible-hint",
      errorId: "deductible-error",
      invalid: true,
      disabled: false,
      required: true,
    };
    render(
      <FieldContext value={field}>
        <Input aria-describedby="extra" />
      </FieldContext>,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "deductible");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "extra deductible-hint deductible-error");
  });

  it("lets explicit props override the field", () => {
    const field: FieldContextValue = { id: "a", invalid: true, disabled: true, required: false };
    render(
      <FieldContext value={field}>
        <Input id="b" invalid={false} disabled={false} />
      </FieldContext>,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "b");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toBeEnabled();
  });
});
