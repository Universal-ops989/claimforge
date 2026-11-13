import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../button/button";
import { Input } from "../input/input";
import { Grid, Inline, Stack } from "../layout/layout";
import { Select } from "../select/select";
import { Textarea } from "../textarea/textarea";
import { FormField } from "./form-field";

const meta = {
  title: "Components/FormField",
  component: FormField,
  args: { label: "Policy number", children: <Input placeholder="HO-4471-2290" /> },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: "Found on the policy declarations page." },
};

export const WithError: Story = {
  args: {
    hint: "Found on the policy declarations page.",
    error: "Policy number must start with HO-",
    children: <Input defaultValue="4471-2290" />,
  },
};

export const Required: Story = { args: { required: true } };

export const WithLabelAction: Story = {
  args: {
    label: "Deductible",
    labelAction: (
      <a href="#deductibles" style={{ fontSize: 12 }}>
        What's this?
      </a>
    ),
    children: <Input prefix="$" inputMode="decimal" />,
  },
};

/** A first-notice-of-loss form section composed from fields and layout primitives. */
export const FormExample: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Stack as="form" gap={5}>
      <Grid columns={2} gap={4}>
        <FormField label="Policyholder" required>
          <Input autoComplete="name" />
        </FormField>
        <FormField label="Phone" hint="We'll text claim updates">
          <Input type="tel" autoComplete="tel" />
        </FormField>
      </Grid>
      <Grid columns={2} gap={4}>
        <FormField label="Loss type" required>
          <Select
            options={[
              { value: "water", label: "Water" },
              { value: "fire", label: "Fire" },
              { value: "storm", label: "Storm" },
            ]}
          />
        </FormField>
        <FormField label="Date of loss" required error="Date can't be in the future">
          <Input type="date" />
        </FormField>
      </Grid>
      <FormField label="What happened?" hint="Include where the damage started.">
        <Textarea maxLength={500} showCount />
      </FormField>
      <Inline justify="end" gap={2}>
        <Button variant="secondary">Cancel</Button>
        <Button type="submit">Create claim</Button>
      </Inline>
    </Stack>
  ),
};
