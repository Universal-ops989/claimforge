import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../button/button";
import { Inline } from "../layout/layout";
import { ToastProvider } from "./toast-provider";
import { toast } from "./toast-store";

const meta = {
  title: "Components/Toast",
  component: ToastProvider,
  parameters: {
    docs: {
      description: {
        component:
          "Mount `ToastProvider` once, then call `toast.success(...)` and friends from anywhere, including API clients and mutation callbacks. Press **F8** to focus the notifications.",
      },
    },
  },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: (args) => (
    <ToastProvider {...args}>
      <Inline gap={2}>
        <Button variant="secondary" onClick={() => toast("Draft saved")}>
          Neutral
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.success("Reading saved", { description: "Kitchen wall: 14%" })}
        >
          Success
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.info("Inspection scheduled", { description: "Tue 10:00" })}
        >
          Info
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.warning("Reading overdue", { description: "Hallway, day 3" })}
        >
          Warning
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.error("Upload failed", {
              description: "3 photos couldn't be uploaded. They'll retry when you're back online.",
            })
          }
        >
          Error
        </Button>
      </Inline>
    </ToastProvider>
  ),
};

export const WithUndo: Story = {
  render: (args) => (
    <ToastProvider {...args}>
      <Button
        variant="danger"
        onClick={() =>
          toast({
            title: "Photo deleted",
            action: {
              label: "Undo",
              altText: "Restore the photo from the trash",
              onClick: () => toast.success("Photo restored"),
            },
          })
        }
      >
        Delete photo
      </Button>
    </ToastProvider>
  ),
};

/** Only three are visible; the rest wait their turn. */
export const Queue: Story = {
  render: (args) => (
    <ToastProvider {...args}>
      <Button
        onClick={() => {
          for (let i = 1; i <= 6; i += 1) toast.success(`Photo ${String(i)} uploaded`);
        }}
      >
        Upload 6 photos
      </Button>
    </ToastProvider>
  ),
};

/** Reusing an id updates the toast in place, e.g. for progress. */
export const UpdateInPlace: Story = {
  render: (args) => (
    <ToastProvider {...args}>
      <Button
        onClick={() => {
          toast.info("Generating report…", { id: "report", duration: Infinity });
          setTimeout(() => {
            toast.success("Report ready", { id: "report", description: "CF-1042 photo report" });
          }, 2000);
        }}
      >
        Generate report
      </Button>
    </ToastProvider>
  ),
};
