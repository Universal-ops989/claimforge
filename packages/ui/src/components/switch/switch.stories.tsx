import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Stack } from "../layout/layout";
import { Switch } from "./switch";

const meta = {
  title: "Components/Switch",
  component: Switch,
  args: { label: "Email notifications", onCheckedChange: fn() },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    label: "Daily drying summary",
    description: "Email the project team a summary of yesterday's readings.",
    defaultChecked: true,
  },
};

export const Sizes: Story = {
  render: () => (
    <Stack gap={3}>
      <Switch size="sm" label="Small" />
      <Switch size="md" label="Medium" defaultChecked />
    </Stack>
  ),
};

/** A typical settings list: labels first, switches aligned to the end. */
export const SettingsList: Story = {
  render: () => (
    <Stack gap={4} style={{ width: 380 }}>
      <Switch
        labelPosition="start"
        label="Assignment alerts"
        description="When a claim is assigned to you"
        defaultChecked
      />
      <Switch
        labelPosition="start"
        label="Overdue readings"
        description="When a drying log misses its daily reading"
        defaultChecked
      />
      <Switch labelPosition="start" label="Weekly report" description="Every Monday morning" />
    </Stack>
  ),
};

export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
