import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Checkbox } from "../checkbox/checkbox";
import { Input } from "../input/input";
import { Select } from "../select/select";
import { Textarea } from "../textarea/textarea";
import { FormField } from "./form-field";

describe("FormField", () => {
  it("labels the control", () => {
    render(
      <FormField label="Policy number">
        <Input />
      </FormField>,
    );

    expect(screen.getByRole("textbox", { name: "Policy number" })).toBeInTheDocument();
  });

  it("describes the control with the hint", () => {
    render(
      <FormField label="Policy number" hint="Found on the declarations page">
        <Input />
      </FormField>,
    );

    expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
      "Found on the declarations page",
    );
  });

  it("marks the control invalid and announces the error with the hint", () => {
    render(
      <FormField label="Policy number" hint="Found on the declarations page" error="Required">
        <Input />
      </FormField>,
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Found on the declarations page Required");
  });

  it("treats empty or false errors as valid", () => {
    render(
      <FormField label="Name" error="">
        <Input />
      </FormField>,
    );

    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });

  it("propagates required and disabled, with a decorative asterisk", () => {
    render(
      <FormField label="Date of loss" required disabled>
        <Input type="date" />
      </FormField>,
    );

    const input = screen.getByLabelText(/Date of loss/);
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps a visually hidden label accessible", () => {
    render(
      <FormField label="Search" hideLabel>
        <Input />
      </FormField>,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
  });

  it.each([
    ["Textarea", <Textarea key="t" />, "textbox"],
    ["Select", <Select key="s" options={[{ value: "a", label: "A" }]} />, "combobox"],
    ["Checkbox", <Checkbox key="c" />, "checkbox"],
  ] as const)("wires up %s", (_name, control, role) => {
    render(
      <FormField label="Field" error="Bad value">
        {control}
      </FormField>,
    );

    const element = screen.getByRole(role, { name: "Field" });
    expect(element).toHaveAttribute("aria-invalid", "true");
    expect(element).toHaveAccessibleDescription("Bad value");
  });
});
