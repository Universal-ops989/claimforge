import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { FormField } from "../field/form-field";
import { Stack } from "../layout/layout";
import { Text } from "../text/text";
import { DatePicker, DateRangePicker, type DateRange } from "./date-picker";

const meta = {
  title: "Components/DatePicker",
  component: DatePicker,
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A loss can't be in the future, so `max` is set to the claim's report date. */
export const DateOfLoss: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>("2026-11-02");
    return (
      <Stack gap={2}>
        <FormField label="Date of loss" required hint="When the damage occurred">
          <DatePicker value={value} onChange={setValue} max="2026-11-13" />
        </FormField>
        <Text size="xs" tone="muted">
          value = {JSON.stringify(value)}
        </Text>
      </Stack>
    );
  },
};

export const Empty: Story = {
  render: function Render() {
    const [value, setValue] = useState<string | null>(null);
    return (
      <FormField label="Inspection date">
        <DatePicker value={value} onChange={setValue} min="2026-11-13" />
      </FormField>
    );
  },
};

export const Invalid: Story = {
  render: () => (
    <FormField label="Date of loss" error="Date of loss is required" required>
      <DatePicker value={null} />
    </FormField>
  ),
};

export const Range: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render() {
    const [range, setRange] = useState<DateRange>({ start: "2026-10-20", end: "2026-11-05" });
    return (
      <FormField label="Loss date between">
        <DateRangePicker value={range} onChange={setRange} max="2026-11-13" />
      </FormField>
    );
  },
};
