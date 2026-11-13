import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderOpen, SearchX } from "lucide-react";

import { Button } from "../button/button";
import { Card, CardBody } from "../card/card";
import { Inline, Stack } from "../layout/layout";
import { Skeleton, SkeletonText } from "../skeleton/skeleton";
import { Spinner } from "../spinner/spinner";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Components/Feedback states",
  component: EmptyState,
  args: { title: "No claims yet" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstRun: Story = {
  args: {
    icon: <FolderOpen />,
    title: "No claims yet",
    description: "Create your first claim to start documenting rooms, photos and readings.",
    actions: (
      <>
        <Button>New claim</Button>
        <Button variant="secondary">Import from CSV</Button>
      </>
    ),
  },
};

export const NoResults: Story = {
  args: {
    icon: <SearchX />,
    size: "compact",
    title: "No claims match your filters",
    description: "Try a different status or a wider loss-date range.",
    actions: (
      <Button variant="secondary" size="sm">
        Clear filters
      </Button>
    ),
  },
};

export const Spinners: Story = {
  render: () => (
    <Inline gap={4}>
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" label="Generating report" />
      <span style={{ color: "var(--cf-color-accent)" }}>
        <Spinner size="md" label="Syncing" />
      </span>
    </Inline>
  ),
};

/** A claim card while it loads: shapes match the real content to avoid layout shift. */
export const SkeletonCard: Story = {
  render: () => (
    <Card style={{ width: 360 }} role="status" aria-busy="true" aria-label="Loading claim">
      <CardBody>
        <Stack gap={4}>
          <Inline gap={3} wrap={false}>
            <Skeleton shape="circle" height={40} />
            <Stack gap={2} style={{ flex: 1 }}>
              <Skeleton width="50%" />
              <Skeleton width="30%" />
            </Stack>
          </Inline>
          <Skeleton shape="rect" height={120} />
          <SkeletonText lines={3} />
        </Stack>
      </CardBody>
    </Card>
  ),
};
