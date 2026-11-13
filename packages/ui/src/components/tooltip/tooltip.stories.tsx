import type { Meta, StoryObj } from "@storybook/react-vite";
import { Info, Pencil, Trash2, UserPlus } from "lucide-react";

import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { Icon } from "../icon/icon";
import { IconButton } from "../icon-button/icon-button";
import { Input } from "../input/input";
import { Inline, Stack } from "../layout/layout";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "../popover/popover";
import { Text } from "../text/text";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Components/Tooltip & Popover",
  component: Tooltip,
  args: { content: "Edit room", children: <Button>Hover or focus me</Button> },
  argTypes: {
    children: { control: false },
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TooltipDefault: Story = { name: "Tooltip" };

/** Pair with icon-only buttons; turn off their native title to avoid double tooltips. */
export const IconToolbar: Story = {
  render: () => (
    <Inline gap={1}>
      <Tooltip content="Edit room">
        <IconButton label="Edit room" showTitle={false} icon={<Icon icon={Pencil} />} />
      </Tooltip>
      <Tooltip content="Assign technician">
        <IconButton label="Assign technician" showTitle={false} icon={<Icon icon={UserPlus} />} />
      </Tooltip>
      <Tooltip content="Delete room" side="bottom">
        <IconButton label="Delete room" showTitle={false} icon={<Icon icon={Trash2} />} />
      </Tooltip>
    </Inline>
  ),
};

export const ExplainingATerm: Story = {
  render: () => (
    <Inline gap={1}>
      <Text>GPP 62.4</Text>
      <Tooltip content="Grains per pound: absolute humidity. Lower is drier; compare with the unaffected area.">
        <IconButton
          size="sm"
          label="What is GPP?"
          showTitle={false}
          icon={<Icon icon={Info} size="sm" />}
        />
      </Tooltip>
    </Inline>
  ),
};

export const PopoverAssign: Story = {
  name: "Popover",
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Assign technician</Button>
      </PopoverTrigger>
      <PopoverContent title="Assign technician" showCloseButton showArrow>
        <Stack gap={3}>
          <Input aria-label="Search technicians" placeholder="Search by name" />
          <Stack gap={2}>
            {["Tom Okafor", "Priya Raman", "Luis Ortega"].map((name) => (
              <PopoverClose key={name} asChild>
                <Button variant="ghost" leadingIcon={<Avatar name={name} size="xs" />}>
                  {name}
                </Button>
              </PopoverClose>
            ))}
          </Stack>
        </Stack>
      </PopoverContent>
    </Popover>
  ),
};
