import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Save claim", onClick: fn() },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    leadingIcon: { control: false },
    trailingIcon: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12 }}>
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="danger">
        Danger
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

export const WithIcon: Story = {
  args: { children: "New claim", leadingIcon: <PlusIcon /> },
};

/** The spinner keeps the button's width so surrounding layout does not shift. */
export const Loading: Story = {
  args: { children: "Generating report", loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const AsLink: Story = {
  name: "As link (asChild)",
  args: { variant: "secondary" },
  render: (args) => (
    <Button {...args} asChild>
      <a href="#claim-42">Open claim #42</a>
    </Button>
  ),
};

export const ClickInteraction: Story = {
  name: "Interaction: click",
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save claim" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
