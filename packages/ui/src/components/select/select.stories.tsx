import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { Text } from "../text/text";
import { Select } from "./select";

const meta = {
  title: "Components/Select",
  component: Select,
  args: {
    "aria-label": "Loss type",
    placeholder: "Choose loss type",
    onValueChange: fn(),
    options: [
      { value: "water", label: "Water" },
      { value: "fire", label: "Fire / smoke" },
      { value: "wind", label: "Wind / hail" },
      { value: "mold", label: "Mold" },
      { value: "other", label: "Other" },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** IICRC water categories, grouped by source. */
export const Grouped: Story = {
  args: {
    "aria-label": "Water category",
    placeholder: "Select category",
    options: [
      {
        label: "Clean",
        options: [{ value: "cat1", label: "Category 1: clean water" }],
      },
      {
        label: "Contaminated",
        options: [
          { value: "cat2", label: "Category 2: grey water" },
          { value: "cat3", label: "Category 3: black water" },
        ],
      },
    ],
  },
};

export const Controlled: Story = {
  render: function Render(args) {
    const [value, setValue] = useState("fire");
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <Select {...args} value={value} onValueChange={setValue} />
        <Text size="sm" tone="muted">
          Selected: {value}
        </Text>
      </div>
    );
  },
};

export const Invalid: Story = { args: { invalid: true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "water" } };

export const KeyboardInteraction: Story = {
  name: "Interaction: keyboard",
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox");
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await expect(args.onValueChange).toHaveBeenCalledWith("wind");
  },
};
