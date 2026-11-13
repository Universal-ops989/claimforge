import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type Resolver,
  type ResolverResult,
} from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import {
  FormCheckbox,
  FormCheckboxGroup,
  FormInput,
  FormRadioGroup,
  FormSelect,
  FormSwitch,
  FormTextarea,
} from "./form-fields";

interface ClaimForm {
  policyNumber: string;
  description: string;
  lossType: string;
  category: string;
  areas: string[];
  emergency: boolean;
  notify: boolean;
}

const DEFAULTS: DefaultValues<ClaimForm> = {
  policyNumber: "",
  description: "",
  lossType: "",
  category: "",
  areas: [],
  emergency: false,
  notify: false,
};

function Harness({
  onSubmit,
  children,
}: {
  onSubmit: (values: ClaimForm) => void;
  children: ReactNode;
}) {
  const methods = useForm<ClaimForm>({ defaultValues: DEFAULTS });
  return (
    <FormProvider {...methods}>
      <form onSubmit={(e) => void methods.handleSubmit(onSubmit)(e)}>
        {children}
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

describe("form adapters", () => {
  it("collects values from every adapter", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness onSubmit={onSubmit}>
        <FormInput<ClaimForm> name="policyNumber" label="Policy number" />
        <FormTextarea<ClaimForm> name="description" label="Description" />
        <FormSelect<ClaimForm>
          name="lossType"
          label="Loss type"
          options={[
            { value: "water", label: "Water" },
            { value: "fire", label: "Fire" },
          ]}
        />
        <FormRadioGroup<ClaimForm>
          name="category"
          label="Category"
          options={[
            { value: "1", label: "Category 1" },
            { value: "2", label: "Category 2" },
          ]}
        />
        <FormCheckboxGroup<ClaimForm>
          name="areas"
          label="Areas"
          options={[
            { value: "walls", label: "Walls" },
            { value: "floor", label: "Floor" },
          ]}
        />
        <FormCheckbox<ClaimForm> name="emergency" label="Emergency services" />
        <FormSwitch<ClaimForm> name="notify" label="Notify policyholder" />
      </Harness>,
    );

    await userEvent.type(screen.getByRole("textbox", { name: "Policy number" }), "HO-1");
    await userEvent.type(screen.getByRole("textbox", { name: "Description" }), "Leak");
    await userEvent.click(screen.getByRole("combobox", { name: "Loss type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Fire" }));
    await userEvent.click(screen.getByRole("radio", { name: "Category 2" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Floor" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Emergency services" }));
    await userEvent.click(screen.getByRole("switch", { name: "Notify policyholder" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      policyNumber: "HO-1",
      description: "Leak",
      lossType: "fire",
      category: "2",
      areas: ["floor"],
      emergency: true,
      notify: true,
    });
  });

  it("shows resolver (schema) errors on the matching fields", async () => {
    // Apps validate with a Zod schema resolver; a hand-written resolver has the same contract.
    const resolver: Resolver<ClaimForm> = (values) =>
      Promise.resolve<ResolverResult<ClaimForm>>(
        values.policyNumber && values.category
          ? { values, errors: {} }
          : {
              values: {},
              errors: {
                policyNumber: { type: "required", message: "Policy number is required" },
                category: { type: "required", message: "Pick a category" },
              },
            },
      );

    function WithResolver() {
      const methods = useForm<ClaimForm>({ defaultValues: DEFAULTS, resolver });
      return (
        <FormProvider {...methods}>
          <form onSubmit={(e) => void methods.handleSubmit(vi.fn())(e)}>
            <FormInput<ClaimForm> name="policyNumber" label="Policy number" />
            <FormRadioGroup<ClaimForm>
              name="category"
              label="Category"
              options={[{ value: "1", label: "Category 1" }]}
            />
            <button type="submit">Submit</button>
          </form>
        </FormProvider>
      );
    }
    render(<WithResolver />);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    const input = screen.getByRole("textbox", { name: "Policy number" });
    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
    expect(input).toHaveAccessibleDescription("Policy number is required");
    expect(screen.getByRole("radiogroup", { name: "Category" })).toHaveAccessibleDescription(
      "Pick a category",
    );
  });

  it("applies registerOptions rules to FormInput", async () => {
    render(
      <Harness onSubmit={vi.fn()}>
        <FormInput<ClaimForm>
          name="policyNumber"
          label="Policy number"
          registerOptions={{ required: "Required" }}
        />
      </Harness>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Required");
    });
  });
});
