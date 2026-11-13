import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FormProvider, useForm, useWatch, type Resolver } from "react-hook-form";

import { Button } from "../components/button/button";
import { Grid, Inline, Stack } from "../components/layout/layout";
import { Text } from "../components/text/text";
import {
  FormCheckbox,
  FormCheckboxGroup,
  FormInput,
  FormRadioGroup,
  FormSelect,
  FormTextarea,
} from "./form-fields";

interface NewClaim {
  policyholder: string;
  policyNumber: string;
  lossType: string;
  category: string;
  areas: string[];
  description: string;
  emergency: boolean;
}

/** Stand-in for a Zod schema resolver so the story has no extra dependencies. */
const resolver: Resolver<NewClaim> = (values) => {
  const errors: Record<string, { type: string; message: string }> = {};
  if (!values.policyholder) errors.policyholder = { type: "required", message: "Enter a name" };
  if (!/^HO-\d{4}-\d{4}$/.test(values.policyNumber))
    errors.policyNumber = { type: "pattern", message: "Use the format HO-1234-5678" };
  if (!values.lossType) errors.lossType = { type: "required", message: "Choose a loss type" };
  if (values.lossType === "water" && !values.category)
    errors.category = { type: "required", message: "Water losses need a category" };
  return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} };
};

function NewClaimForm() {
  const [submitted, setSubmitted] = useState<NewClaim | null>(null);
  const methods = useForm<NewClaim>({
    resolver,
    defaultValues: {
      policyholder: "",
      policyNumber: "",
      lossType: "",
      category: "",
      areas: [],
      description: "",
      emergency: false,
    },
  });
  const lossType = useWatch({ control: methods.control, name: "lossType" });

  return (
    <FormProvider {...methods}>
      <form onSubmit={(e) => void methods.handleSubmit(setSubmitted)(e)} noValidate>
        <Stack gap={5} style={{ width: 560 }}>
          <Grid columns={2} gap={4}>
            <FormInput<NewClaim> name="policyholder" label="Policyholder" required />
            <FormInput<NewClaim>
              name="policyNumber"
              label="Policy number"
              placeholder="HO-1234-5678"
              required
            />
          </Grid>
          <FormSelect<NewClaim>
            name="lossType"
            label="Loss type"
            required
            options={[
              { value: "water", label: "Water" },
              { value: "fire", label: "Fire / smoke" },
              { value: "storm", label: "Wind / hail" },
            ]}
          />
          {lossType === "water" && (
            <FormRadioGroup<NewClaim>
              name="category"
              label="Water category"
              orientation="horizontal"
              options={[
                { value: "1", label: "Category 1" },
                { value: "2", label: "Category 2" },
                { value: "3", label: "Category 3" },
              ]}
            />
          )}
          <FormCheckboxGroup<NewClaim>
            name="areas"
            label="Affected areas"
            orientation="horizontal"
            options={[
              { value: "ceiling", label: "Ceiling" },
              { value: "walls", label: "Walls" },
              { value: "floor", label: "Floor" },
            ]}
          />
          <FormTextarea<NewClaim>
            name="description"
            label="What happened?"
            maxLength={500}
            showCount
          />
          <FormCheckbox<NewClaim>
            name="emergency"
            label="Emergency mitigation needed"
            description="Dispatches the on-call crew immediately."
          />
          <Inline justify="end" gap={2}>
            <Button
              variant="secondary"
              onClick={() => {
                methods.reset();
                setSubmitted(null);
              }}
            >
              Reset
            </Button>
            <Button type="submit">Create claim</Button>
          </Inline>
          {submitted && (
            <Text as="p" size="sm" tone="success">
              Submitted: {JSON.stringify(submitted)}
            </Text>
          )}
        </Stack>
      </form>
    </FormProvider>
  );
}

const meta = {
  title: "Forms/React Hook Form",
  component: NewClaimForm,
  parameters: {
    docs: {
      description: {
        component:
          "Adapters from `@claimforge/ui/form` bind controls to a react-hook-form `FormProvider`. Submit the empty form to see validation errors wired to each field.",
      },
    },
  },
} satisfies Meta<typeof NewClaimForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewClaimExample: Story = { name: "New claim form" };
