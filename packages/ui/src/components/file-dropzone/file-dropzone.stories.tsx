import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { fn } from "storybook/test";

import { Stack } from "../layout/layout";
import { FileDropzone } from "./file-dropzone";
import { FileUploadList, type UploadItem } from "./file-upload-list";

const meta = {
  title: "Components/FileDropzone",
  component: FileDropzone,
  args: { onFilesAccepted: fn(), onFilesRejected: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Photos: Story = {
  args: {
    title: "Drop room photos here",
    accept: "image/*",
    maxSize: 25 * 1024 * 1024,
    maxFiles: 50,
    capture: "environment",
  },
};

export const SingleDocument: Story = {
  args: {
    title: "Drop the signed work authorization",
    accept: ".pdf",
    multiple: false,
    browseLabel: "Choose PDF",
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    // WCAG 1.4.3 exempts inactive (disabled) components from contrast requirements;
    // axe cannot tell that the dimmed text belongs to a disabled control.
    a11y: { config: { rules: [{ id: "color-contrast", enabled: false }] } },
  },
};

/** Simulated uploads: progress advances, one fails and can be retried. */
export const WithUploadList: Story = {
  render: function Render(args) {
    const [items, setItems] = useState<UploadItem[]>([]);

    useEffect(() => {
      const timer = setInterval(() => {
        setItems((current) =>
          current.map((item) => {
            if (item.status !== "uploading") return item;
            const progress = (item.progress ?? 0) + 12;
            if (item.name.includes("fail") && progress > 60) {
              return { ...item, status: "error", error: "Connection lost. Try again." };
            }
            return progress >= 100 ? { ...item, status: "done" } : { ...item, progress };
          }),
        );
      }, 400);
      return () => {
        clearInterval(timer);
      };
    }, []);

    return (
      <Stack gap={4}>
        <FileDropzone
          {...args}
          accept="image/*"
          title="Drop room photos here (name one 'fail.jpg' to see an error)"
          onFilesAccepted={(files) => {
            setItems((current) => [
              ...current,
              ...files.map((f) => ({
                id: `${f.name}-${String(Date.now())}`,
                name: f.name,
                size: f.size,
                type: f.type,
                status: "uploading" as const,
                progress: 0,
              })),
            ]);
          }}
        />
        <FileUploadList
          items={items}
          onRemove={(id) => {
            setItems((current) => current.filter((i) => i.id !== id));
          }}
          onRetry={(id) => {
            setItems((current) =>
              current.map((i) =>
                i.id === id
                  ? {
                      ...i,
                      name: i.name.replace("fail", "retried"),
                      status: "uploading",
                      progress: 0,
                    }
                  : i,
              ),
            );
          }}
        />
      </Stack>
    );
  },
};
