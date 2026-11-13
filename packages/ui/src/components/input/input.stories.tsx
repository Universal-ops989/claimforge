import type { Meta, StoryObj } from "@storybook/react-vite";
import { Search } from "lucide-react";

import { Icon } from "../icon/icon";
import { Stack } from "../layout/layout";
import { Input } from "./input";

const meta = {
  title: "Components/Input",
  component: Input,
  args: { "aria-label": "Policy number", placeholder: "e.g. HO-4471-2290" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    prefix: { control: false },
    suffix: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <Stack gap={3}>
      <Input {...args} size="sm" aria-label="Small" />
      <Input {...args} size="md" aria-label="Medium" />
      <Input {...args} size="lg" aria-label="Large" />
    </Stack>
  ),
};

export const WithPrefixAndSuffix: Story = {
  render: () => (
    <Stack gap={3}>
      <Input
        aria-label="Search claims"
        placeholder="Search claims"
        prefix={<Icon icon={Search} />}
      />
      <Input aria-label="Deductible" inputMode="decimal" prefix="$" defaultValue="1,000" />
      <Input aria-label="Moisture content" inputMode="decimal" suffix="%" defaultValue="18.5" />
    </Stack>
  ),
};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: "not-a-policy" },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "HO-4471-2290" },
};
