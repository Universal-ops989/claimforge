import type { Meta, StoryObj } from "@storybook/react-vite";
import { Camera, Droplets, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { fn } from "storybook/test";

import { Icon } from "../icon/icon";
import { IconButton } from "./icon-button";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  args: { label: "Edit room", icon: <Icon icon={Pencil} />, onClick: fn() },
  argTypes: {
    icon: { control: false },
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8 }}>
      <IconButton {...args} variant="primary" label="Take photo" icon={<Icon icon={Camera} />} />
      <IconButton
        {...args}
        variant="secondary"
        label="Add reading"
        icon={<Icon icon={Droplets} />}
      />
      <IconButton
        {...args}
        variant="ghost"
        label="More actions"
        icon={<Icon icon={MoreHorizontal} />}
      />
      <IconButton {...args} variant="danger" label="Delete" icon={<Icon icon={Trash2} />} />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <IconButton {...args} variant="secondary" size="sm" />
      <IconButton {...args} variant="secondary" size="md" />
      <IconButton {...args} variant="secondary" size="lg" />
    </div>
  ),
};
