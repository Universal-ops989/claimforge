import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Download, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";

import { Button } from "../button/button";
import { Icon } from "../icon/icon";
import { IconButton } from "../icon-button/icon-button";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "./menu";

const meta = {
  title: "Components/Menu",
  component: MenuContent,
} satisfies Meta<typeof MenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Row actions on a claim. Destructive actions go last, after a separator. */
export const RowActions: Story = {
  render: () => (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="Claim actions" icon={<Icon icon={MoreHorizontal} />} />
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<Pencil />} shortcut="E" onSelect={fn()}>
          Edit details
        </MenuItem>
        <MenuItem icon={<UserPlus />} shortcut="A" onSelect={fn()}>
          Assign
        </MenuItem>
        <MenuItem icon={<Copy />} onSelect={fn()}>
          Duplicate
        </MenuItem>
        <MenuItem icon={<Download />} disabled>
          Export (no reports yet)
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} tone="danger" onSelect={fn()}>
          Delete claim
        </MenuItem>
      </MenuContent>
    </Menu>
  ),
};

export const ColumnVisibility: Story = {
  render: function Render() {
    const [columns, setColumns] = useState({
      status: true,
      adjuster: true,
      lossDate: true,
      address: false,
    });
    const labels: Record<keyof typeof columns, string> = {
      status: "Status",
      adjuster: "Adjuster",
      lossDate: "Loss date",
      address: "Address",
    };
    return (
      <Menu>
        <MenuTrigger asChild>
          <Button variant="secondary">Columns</Button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuGroup>
            <MenuLabel>Visible columns</MenuLabel>
            {(Object.keys(columns) as (keyof typeof columns)[]).map((key) => (
              <MenuCheckboxItem
                key={key}
                checked={columns[key]}
                onCheckedChange={(checked) => {
                  setColumns((prev) => ({ ...prev, [key]: checked }));
                }}
                // Keep the menu open while toggling several columns.
                onSelect={(event) => {
                  event.preventDefault();
                }}
              >
                {labels[key]}
              </MenuCheckboxItem>
            ))}
          </MenuGroup>
        </MenuContent>
      </Menu>
    );
  },
};
