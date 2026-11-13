import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Camera,
  ClipboardList,
  Droplets,
  FileText,
  Fan,
  Home,
  Thermometer,
  TriangleAlert,
} from "lucide-react";

import { Icon } from "./icon";

const meta = {
  title: "Components/Icon",
  component: Icon,
  args: { icon: Droplets, size: "md" },
  argTypes: {
    icon: { control: false },
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg", "xl"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Wraps any [lucide](https://lucide.dev/icons) icon with consistent sizing. Icons are decorative (`aria-hidden`) unless you pass a `label`.",
      },
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 16, alignItems: "end", color: "var(--cf-color-text)" }}>
      {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
        <Icon key={size} {...args} size={size} />
      ))}
    </div>
  ),
};

/** Icons commonly used across ClaimForge. */
export const DomainIcons: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, color: "var(--cf-color-text)" }}>
      <Icon icon={Home} label="Property" />
      <Icon icon={Camera} label="Photos" />
      <Icon icon={Droplets} label="Moisture" />
      <Icon icon={Thermometer} label="Atmospherics" />
      <Icon icon={Fan} label="Equipment" />
      <Icon icon={ClipboardList} label="Tasks" />
      <Icon icon={FileText} label="Reports" />
      <Icon icon={TriangleAlert} label="Alert" />
    </div>
  ),
};
