import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { RadioGroup } from "./radio-group";

const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  args: {
    label: "Water category",
    onValueChange: fn(),
    defaultValue: "2",
    options: [
      { value: "1", label: "Category 1", description: "Clean water, e.g. a broken supply line" },
      { value: "2", label: "Category 2", description: "Grey water, e.g. dishwasher overflow" },
      { value: "3", label: "Category 3", description: "Black water, e.g. sewage or flood water" },
    ],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 460 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Horizontal: Story = {
  args: {
    label: "Damage class",
    orientation: "horizontal",
    defaultValue: "2",
    options: [
      { value: "1", label: "Class 1" },
      { value: "2", label: "Class 2" },
      { value: "3", label: "Class 3" },
      { value: "4", label: "Class 4" },
    ],
  },
};

/** Card tiles: the whole tile is clickable. Good for choices that need explaining. */
export const Cards: Story = {
  args: { variant: "card" },
};

export const HorizontalCards: Story = {
  args: {
    label: "Loss type",
    variant: "card",
    orientation: "horizontal",
    defaultValue: "water",
    options: [
      { value: "water", label: "Water", description: "Leaks, floods, burst pipes" },
      { value: "fire", label: "Fire", description: "Fire, smoke and soot" },
      { value: "storm", label: "Storm", description: "Wind, hail, fallen trees" },
    ],
  },
};

export const Invalid: Story = { args: { invalid: true, defaultValue: undefined } };

export const Disabled: Story = { args: { disabled: true } };
