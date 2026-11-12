import type { Meta, StoryObj } from "@storybook/react-vite";

import { VisuallyHidden } from "./visually-hidden";

const meta = {
  title: "Utilities/VisuallyHidden",
  component: VisuallyHidden,
  args: { children: "Only screen readers announce this" },
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The text is in the DOM but takes up no visual space. */
export const Default: Story = {};

/** A typical use: giving an icon-only button an accessible name. */
export const IconButtonLabel: Story = {
  render: () => (
    <button type="button" style={{ fontSize: 20 }}>
      <span aria-hidden="true">×</span>
      <VisuallyHidden>Close dialog</VisuallyHidden>
    </button>
  ),
};
