import type { Meta, StoryObj } from "@storybook/react-vite";

import { Inline, Stack } from "../layout/layout";
import { Avatar, AvatarGroup } from "./avatar";

/** Inline SVG so stories work offline and in CI. */
const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#93b4fd"/><circle cx="32" cy="26" r="12" fill="#1e2eaf"/><rect x="12" y="42" width="40" height="22" rx="11" fill="#1e2eaf"/></svg>',
  );

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  args: { name: "Dana Whitfield" },
  argTypes: { size: { control: "inline-radio", options: ["xs", "sm", "md", "lg", "xl"] } },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {};

export const WithPhoto: Story = { args: { src: PHOTO } };

/** A broken URL falls back to initials. */
export const BrokenImage: Story = { args: { src: "https://invalid.example/photo.jpg" } };

export const Sizes: Story = {
  render: (args) => (
    <Inline gap={3}>
      {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </Inline>
  ),
};

/** Each name always gets the same color. */
export const Palette: Story = {
  render: () => (
    <Inline gap={2}>
      {[
        "Dana Whitfield",
        "Marcus Lee",
        "Priya Raman",
        "Tom Okafor",
        "Sofia Mendes",
        "Ivan Petrov",
        "Grace Kim",
        "Luis Ortega",
      ].map((name) => (
        <Avatar key={name} name={name} />
      ))}
    </Inline>
  ),
};

export const Group: Story = {
  render: () => (
    <Stack gap={4}>
      <AvatarGroup
        people={[
          { name: "Dana Whitfield", src: PHOTO },
          { name: "Marcus Lee" },
          { name: "Priya Raman" },
        ]}
      />
      <AvatarGroup
        max={3}
        size="sm"
        people={[
          { name: "Dana Whitfield" },
          { name: "Marcus Lee" },
          { name: "Priya Raman" },
          { name: "Tom Okafor" },
          { name: "Sofia Mendes" },
        ]}
      />
    </Stack>
  ),
};
