import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { Stack } from "../layout/layout";
import { Checkbox, type CheckedState } from "./checkbox";
import { CheckboxGroup } from "./checkbox-group";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  args: { label: "Asbestos testing required", onCheckedChange: fn() },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    label: "Pre-existing damage",
    description: "Damage observed that predates the reported date of loss.",
  },
};

export const States: Story = {
  render: () => (
    <Stack gap={3}>
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" checked="indeterminate" />
      <Checkbox label="Invalid" invalid />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Disabled checked" disabled defaultChecked />
    </Stack>
  ),
};

const ROOMS = ["Kitchen", "Hallway", "Dining room"];

/** A "select all" checkbox that shows the indeterminate state for partial selection. */
export const SelectAll: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<string[]>(["Kitchen"]);
    const all: CheckedState =
      selected.length === ROOMS.length ? true : selected.length > 0 ? "indeterminate" : false;
    return (
      <Stack gap={2}>
        <Checkbox
          label="All rooms"
          checked={all}
          onCheckedChange={(checked) => {
            setSelected(checked === true ? ROOMS : []);
          }}
        />
        <Stack gap={2} style={{ paddingLeft: 26 }}>
          {ROOMS.map((room) => (
            <Checkbox
              key={room}
              label={room}
              checked={selected.includes(room)}
              onCheckedChange={(checked) => {
                setSelected((prev) =>
                  checked === true ? [...prev, room] : prev.filter((r) => r !== room),
                );
              }}
            />
          ))}
        </Stack>
      </Stack>
    );
  },
};

export const Group: Story = {
  render: () => (
    <CheckboxGroup
      label="Affected areas"
      defaultValue={["walls"]}
      options={[
        { value: "ceiling", label: "Ceiling" },
        { value: "walls", label: "Walls", description: "Drywall wicking above 2 ft" },
        { value: "floor", label: "Floor" },
        { value: "cabinets", label: "Cabinetry" },
      ]}
    />
  ),
};

export const HorizontalGroup: Story = {
  render: () => (
    <CheckboxGroup
      label="Photo tags"
      orientation="horizontal"
      options={[
        { value: "before", label: "Before" },
        { value: "during", label: "During" },
        { value: "after", label: "After" },
        { value: "overview", label: "Overview" },
      ]}
    />
  ),
};
