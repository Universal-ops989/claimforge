import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { Button } from "../button/button";
import { FormField } from "../field/form-field";
import { Input } from "../input/input";
import { Grid, Stack } from "../layout/layout";
import { Select } from "../select/select";
import { Text } from "../text/text";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "./dialog";

const meta = {
  title: "Components/Dialog",
  component: DialogContent,
  args: { title: "Add room" },
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

function Footer({ primary }: { primary: string }) {
  return (
    <>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button>{primary}</Button>
    </>
  );
}

export const AddRoom: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add room</Button>
      </DialogTrigger>
      <DialogContent
        title="Add room"
        description="Rooms group moisture readings, photos and line items."
        footer={<Footer primary="Add room" />}
      >
        <Stack gap={4}>
          <FormField label="Room name" required>
            <Input placeholder="e.g. Kitchen" />
          </FormField>
          <Grid columns={2} gap={4}>
            <FormField label="Floor">
              <Select
                options={[
                  { value: "basement", label: "Basement" },
                  { value: "1", label: "1st floor" },
                  { value: "2", label: "2nd floor" },
                ]}
              />
            </FormField>
            <FormField label="Area">
              <Input inputMode="decimal" suffix="sq ft" />
            </FormField>
          </Grid>
        </Stack>
      </DialogContent>
    </Dialog>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Add room" }));
    const dialog = await screen.findByRole("dialog", { name: "Add room" });
    // The dialog fades in; wait for the animation instead of checking the first frame.
    await waitFor(() => expect(dialog).toBeVisible());
  },
};

/** Long content scrolls inside the body while the header and footer stay put. */
export const ScrollingContent: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">View drying log</Button>
      </DialogTrigger>
      <DialogContent title="Drying log: Kitchen" size="lg" footer={<Footer primary="Export" />}>
        <Stack gap={3}>
          {Array.from({ length: 30 }, (_, day) => (
            <Text key={day} size="sm">
              Day {day + 1}: wall 18% → target 12%, floor 22% → target 15%
            </Text>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  ),
};

export const Controlled: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <Stack gap={2} align="start">
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          Open from state
        </Button>
        <Text size="sm" tone="muted">
          open = {String(open)}
        </Text>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title="Assign adjuster" size="sm" footer={<Footer primary="Assign" />}>
            <Text size="sm">Dana Whitfield will be notified by email.</Text>
          </DialogContent>
        </Dialog>
      </Stack>
    );
  },
};
