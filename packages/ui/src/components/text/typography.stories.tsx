import type { Meta, StoryObj } from "@storybook/react-vite";

import { Heading } from "../heading/heading";
import { Text } from "./text";

const meta = {
  title: "Components/Typography",
  component: Text,
  args: { children: "Category 2 water damage affecting the kitchen and hallway." },
  argTypes: {
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg", "xl"] },
    weight: { control: "inline-radio", options: ["regular", "medium", "semibold", "bold"] },
    tone: {
      control: "select",
      options: ["default", "muted", "subtle", "accent", "success", "warning", "danger", "inherit"],
    },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 4 }}>
      <Text>Default: primary content</Text>
      <Text tone="muted">Muted: secondary content</Text>
      <Text tone="subtle">Subtle: metadata and timestamps</Text>
      <Text tone="accent">Accent: links and highlights</Text>
      <Text tone="success">Success: dry standard reached</Text>
      <Text tone="warning">Warning: reading overdue</Text>
      <Text tone="danger">Danger: moisture rising</Text>
    </div>
  ),
};

export const Headings: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12 }}>
      <Heading level={1}>Heading 1: Claim #CF-1042</Heading>
      <Heading level={2}>Heading 2: Rooms</Heading>
      <Heading level={3}>Heading 3: Kitchen</Heading>
      <Heading level={4}>Heading 4: Moisture readings</Heading>
      <Heading level={5}>Heading 5: Day 2</Heading>
      <Heading level={6}>Heading 6: Section label</Heading>
    </div>
  ),
};

/** Tabular figures keep columns of readings aligned. */
export const NumericReadings: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 2, width: 160 }}>
      {["18.4%", "112.0%", "9.1%", "27.7%"].map((value) => (
        <Text key={value} numeric align="end">
          {value}
        </Text>
      ))}
    </div>
  ),
};

export const Truncation: Story = {
  render: () => (
    <div style={{ width: 240, display: "grid", gap: 12 }}>
      <Text truncate>1428 Maple Grove Drive, Unit 4B, Springfield Heights</Text>
      <Text lineClamp={2} size="sm" tone="muted">
        Homeowner reports the supply line under the kitchen sink failed overnight. Standing water
        found in the kitchen, hallway and into the dining room carpet.
      </Text>
    </div>
  ),
};
