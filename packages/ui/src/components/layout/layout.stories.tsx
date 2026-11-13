import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { color, radius, space } from "../../tokens";
import { Button } from "../button/button";
import { Text } from "../text/text";
import { Grid, Inline, Stack } from "./layout";

const meta = {
  title: "Components/Layout",
  component: Stack,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

function Box({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: space[4],
        background: color.accentSubtle,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        color: color.text,
      }}
    >
      {children}
    </div>
  );
}

export const StackStory: Story = {
  name: "Stack",
  args: { gap: 3 },
  render: (args) => (
    <Stack {...args}>
      <Box>Living room</Box>
      <Box>Kitchen</Box>
      <Box>Primary bedroom</Box>
    </Stack>
  ),
};

export const InlineStory: Story = {
  name: "Inline",
  render: () => (
    <Inline gap={2} justify="between">
      <Text weight="semibold">Claim #CF-1042</Text>
      <Inline gap={2}>
        <Button variant="secondary">Share</Button>
        <Button>Generate report</Button>
      </Inline>
    </Inline>
  ),
};

export const GridFixed: Story = {
  name: "Grid: fixed columns",
  render: () => (
    <Grid columns={3} gap={3}>
      {["Photos 48", "Readings 112", "Equipment 9", "Tasks 6", "Notes 14", "Reports 2"].map(
        (item) => (
          <Box key={item}>{item}</Box>
        ),
      )}
    </Grid>
  ),
};

/** Resize the canvas: columns reflow without media queries. */
export const GridResponsive: Story = {
  name: "Grid: responsive",
  render: () => (
    <Grid minChildWidth="10rem" gap={3}>
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i}>Photo {i + 1}</Box>
      ))}
    </Grid>
  ),
};
