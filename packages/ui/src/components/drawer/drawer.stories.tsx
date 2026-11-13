import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExternalLink } from "lucide-react";

import { AvatarGroup } from "../avatar/avatar";
import { StatusPill } from "../badge/badge";
import { Button } from "../button/button";
import { CheckboxGroup } from "../checkbox/checkbox-group";
import { Icon } from "../icon/icon";
import { IconButton } from "../icon-button/icon-button";
import { Stack } from "../layout/layout";
import { RadioGroup } from "../radio-group/radio-group";
import { Text } from "../text/text";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "./drawer";

const meta = {
  title: "Components/Drawer",
  component: DrawerContent,
  args: { title: "Claim CF-1042" },
} satisfies Meta<typeof DrawerContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Quick view of a claim from a list, without losing the list's scroll position. */
export const ClaimQuickView: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary">Preview CF-1042</Button>
      </DrawerTrigger>
      <DrawerContent
        title="Claim CF-1042"
        description="1428 Maple Grove Dr, Springfield"
        headerActions={<IconButton label="Open full claim" icon={<Icon icon={ExternalLink} />} />}
        footer={
          <>
            <DrawerClose asChild>
              <Button variant="secondary">Close</Button>
            </DrawerClose>
            <Button>Assign to me</Button>
          </>
        }
      >
        <Stack gap={5}>
          <StatusPill tone="info" pulse>
            Drying in progress, day 3
          </StatusPill>
          <Stack gap={1}>
            <Text size="sm" tone="muted">
              Loss
            </Text>
            <Text>Category 2 water from a failed dishwasher supply line.</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="sm" tone="muted">
              Team
            </Text>
            <AvatarGroup people={[{ name: "Dana Whitfield" }, { name: "Tom Okafor" }]} />
          </Stack>
        </Stack>
      </DrawerContent>
    </Drawer>
  ),
};

export const FilterPanel: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary">Filters</Button>
      </DrawerTrigger>
      <DrawerContent
        title="Filter claims"
        side="left"
        size="sm"
        footer={
          <>
            <Button variant="ghost">Reset</Button>
            <DrawerClose asChild>
              <Button>Apply</Button>
            </DrawerClose>
          </>
        }
      >
        <Stack gap={6}>
          <CheckboxGroup
            label="Status"
            defaultValue={["new", "drying"]}
            options={[
              { value: "new", label: "New" },
              { value: "drying", label: "Drying" },
              { value: "review", label: "Estimate review" },
              { value: "closed", label: "Closed" },
            ]}
          />
          <RadioGroup
            label="Loss date"
            defaultValue="30"
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
              { value: "all", label: "Any time" },
            ]}
          />
        </Stack>
      </DrawerContent>
    </Drawer>
  ),
};
