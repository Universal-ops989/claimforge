import type { Meta, StoryObj } from "@storybook/react-vite";
import { Camera, Droplets } from "lucide-react";

import { Inline, Stack } from "../layout/layout";
import { Badge, StatusPill, type BadgeTone } from "./badge";

const TONES: BadgeTone[] = ["neutral", "accent", "success", "warning", "danger", "info"];

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: { children: "Category 2" },
  argTypes: {
    tone: { control: "select", options: TONES },
    emphasis: { control: "inline-radio", options: ["subtle", "solid"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
    icon: { control: false },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <Stack gap={3}>
      <Inline gap={2}>
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </Inline>
      <Inline gap={2}>
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone} emphasis="solid">
            {tone}
          </Badge>
        ))}
      </Inline>
    </Stack>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <Inline gap={2}>
      <Badge icon={<Camera />}>48 photos</Badge>
      <Badge tone="info" icon={<Droplets />}>
        Water
      </Badge>
    </Inline>
  ),
};

/** Claim workflow states. Text always carries the meaning; color only reinforces it. */
export const ClaimStatuses: Story = {
  render: () => (
    <Inline gap={2}>
      <StatusPill tone="neutral">New</StatusPill>
      <StatusPill tone="accent">Inspection scheduled</StatusPill>
      <StatusPill tone="info" pulse>
        Drying in progress
      </StatusPill>
      <StatusPill tone="warning">Awaiting approval</StatusPill>
      <StatusPill tone="success">Closed</StatusPill>
      <StatusPill tone="danger">Disputed</StatusPill>
    </Inline>
  ),
};
