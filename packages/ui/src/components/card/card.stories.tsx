import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal } from "lucide-react";

import { AvatarGroup } from "../avatar/avatar";
import { StatusPill } from "../badge/badge";
import { Button } from "../button/button";
import { Icon } from "../icon/icon";
import { IconButton } from "../icon-button/icon-button";
import { Grid, Inline, Stack } from "../layout/layout";
import { Text } from "../text/text";
import { Card, CardBody, CardFooter, CardHeader } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: { layout: "padded" },
  argTypes: {
    variant: { control: "inline-radio", options: ["outlined", "elevated"] },
    padding: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Card {...args} style={{ maxWidth: 420 }}>
      <CardHeader
        title="Kitchen"
        description="Category 2 water · Class 2"
        actions={<IconButton label="Room actions" icon={<Icon icon={MoreHorizontal} />} />}
      />
      <CardBody>
        <Text size="sm" tone="muted">
          Affected: lower cabinets, 120 sq ft of vinyl flooring, drywall to 18 in.
        </Text>
      </CardBody>
      <CardFooter divided>
        <Button variant="secondary" size="sm">
          View readings
        </Button>
        <Button size="sm">Add photo</Button>
      </CardFooter>
    </Card>
  ),
};

export const Elevated: Story = { ...Default, args: { variant: "elevated" } };

/** The whole card is one link: a single tab stop with clear hover and focus states. */
export const ClickableClaimCards: Story = {
  render: () => (
    <Grid minChildWidth="16rem" gap={4}>
      {[
        { id: "CF-1042", address: "1428 Maple Grove Dr", status: "Drying", tone: "info" },
        { id: "CF-1043", address: "77 Harbor View Rd", status: "Estimate review", tone: "warning" },
        { id: "CF-1044", address: "9 Orchard Lane", status: "Closed", tone: "success" },
      ].map((claim) => (
        <Card key={claim.id} asChild interactive>
          <a href={`#${claim.id}`}>
            <CardBody>
              <Stack gap={3}>
                <Inline justify="between">
                  <Text weight="semibold">{claim.id}</Text>
                  <StatusPill tone={claim.tone as "info" | "warning" | "success"}>
                    {claim.status}
                  </StatusPill>
                </Inline>
                <Text size="sm" tone="muted">
                  {claim.address}
                </Text>
                <AvatarGroup
                  size="sm"
                  people={[{ name: "Dana Whitfield" }, { name: "Tom Okafor" }]}
                />
              </Stack>
            </CardBody>
          </a>
        </Card>
      ))}
    </Grid>
  ),
};
