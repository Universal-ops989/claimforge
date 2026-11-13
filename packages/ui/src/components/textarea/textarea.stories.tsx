import type { Meta, StoryObj } from "@storybook/react-vite";

import { Textarea } from "./textarea";

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  args: {
    "aria-label": "Loss description",
    placeholder: "Describe what happened, where, and what is affected",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type several lines: the field grows with its content. */
export const AutoResize: Story = {};

export const WithCharacterCount: Story = {
  args: {
    maxLength: 280,
    showCount: true,
    defaultValue: "Supply line under kitchen sink failed overnight.",
  },
};

/** Grows up to five rows, then scrolls. */
export const MaxRows: Story = {
  args: {
    maxRows: 5,
    defaultValue: Array.from({ length: 9 }, (_, i) => `Day ${String(i + 1)}: readings taken`).join(
      "\n",
    ),
  },
};

export const ManualResize: Story = {
  name: "Manual resize (autoResize off)",
  args: { autoResize: false },
};

export const Invalid: Story = { args: { invalid: true } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Locked after approval" } };
