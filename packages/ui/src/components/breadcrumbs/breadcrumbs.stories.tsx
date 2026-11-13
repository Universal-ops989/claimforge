import type { Meta, StoryObj } from "@storybook/react-vite";

import { Breadcrumbs } from "./breadcrumbs";

const meta = {
  title: "Components/Breadcrumbs",
  component: Breadcrumbs,
  args: {
    items: [
      { label: "Claims", href: "#claims" },
      { label: "CF-1042 · Rivera", href: "#cf-1042" },
      { label: "Rooms", href: "#rooms" },
      { label: "Kitchen" },
    ],
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Deep trails collapse their middle levels. */
export const Collapsed: Story = {
  args: {
    maxItems: 4,
    items: [
      { label: "Claims", href: "#claims" },
      { label: "CF-1042", href: "#cf-1042" },
      { label: "Structures", href: "#structures" },
      { label: "Main house", href: "#main" },
      { label: "Rooms", href: "#rooms" },
      { label: "Kitchen", href: "#kitchen" },
      { label: "Moisture map" },
    ],
  },
};
