import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "../button/button";
import { ConfirmDialog } from "./confirm-dialog";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const meta = {
  title: "Components/ConfirmDialog",
  component: ConfirmDialog,
  args: {
    trigger: <Button variant="danger">Delete claim</Button>,
    title: "Delete claim CF-1042?",
    description: "Photos, moisture readings and reports will be permanently removed.",
    confirmLabel: "Delete claim",
    tone: "danger",
    onConfirm: fn(),
  },
  argTypes: { trigger: { control: false } },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Destructive: Story = {};

/** The confirm button shows a spinner until the request finishes. */
export const AsyncSuccess: Story = {
  args: {
    onConfirm: fn(() => wait(1500)),
  },
};

/** When the request fails, the dialog stays open and shows why. */
export const AsyncFailure: Story = {
  args: {
    onConfirm: fn(async () => {
      await wait(1000);
      throw new Error("This claim has an approved estimate and can't be deleted.");
    }),
  },
};

export const NonDestructive: Story = {
  args: {
    trigger: <Button>Close claim</Button>,
    title: "Close claim CF-1042?",
    description: "The claim becomes read-only. You can reopen it later.",
    confirmLabel: "Close claim",
    tone: "default",
  },
};
