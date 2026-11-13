import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Bell,
  Building2,
  ClipboardList,
  FileText,
  Fan,
  Hammer,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react";

import { Avatar } from "../avatar/avatar";
import { StatusPill } from "../badge/badge";
import { Breadcrumbs } from "../breadcrumbs/breadcrumbs";
import { Button } from "../button/button";
import { Card, CardBody, CardHeader } from "../card/card";
import { Heading } from "../heading/heading";
import { Icon } from "../icon/icon";
import { IconButton } from "../icon-button/icon-button";
import { Input } from "../input/input";
import { Grid, Inline, Stack } from "../layout/layout";
import { Text } from "../text/text";
import { AppShell } from "./app-shell";
import { SidebarNav, type NavSection } from "./sidebar-nav";

const SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "#dashboard", icon: <LayoutDashboard /> },
      { label: "Claims", href: "#claims", icon: <ClipboardList />, active: true, badge: 4 },
      { label: "Jobs", href: "#jobs", icon: <Hammer /> },
      { label: "Equipment", href: "#equipment", icon: <Fan /> },
      { label: "Reports", href: "#reports", icon: <FileText /> },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Team", href: "#team", icon: <Users /> },
      { label: "Settings", href: "#settings", icon: <Settings /> },
    ],
  },
];

const Brand = () => (
  <Inline gap={2} wrap={false}>
    <Icon icon={Building2} size="lg" />
    <span>ClaimForge</span>
  </Inline>
);

const meta = {
  title: "Layouts/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: {
    brand: <Brand />,
    navigation: <SidebarNav sections={SECTIONS} />,
    sidebarFooter: (
      <Inline gap={2} wrap={false}>
        <Avatar name="Dana Whitfield" size="sm" />
        <Text size="sm" truncate>
          Dana Whitfield
        </Text>
      </Inline>
    ),
    topbarStart: (
      <Breadcrumbs items={[{ label: "Claims", href: "#claims" }, { label: "CF-1042 · Rivera" }]} />
    ),
    topbarEnd: (
      <>
        <div style={{ width: 240 }}>
          <Input
            size="sm"
            aria-label="Search"
            placeholder="Search claims…"
            prefix={<Icon icon={Search} size="sm" />}
          />
        </div>
        <IconButton label="Notifications" icon={<Icon icon={Bell} />} />
      </>
    ),
    children: null,
  },
  argTypes: {
    brand: { control: false },
    navigation: { control: false },
    sidebarFooter: { control: false },
    topbarStart: { control: false },
    topbarEnd: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function ClaimPage() {
  return (
    <Stack gap={6}>
      <Inline justify="between">
        <Stack gap={1}>
          <Heading level={1} size="xl">
            CF-1042 · Maria Rivera
          </Heading>
          <Text tone="muted">1428 Maple Grove Dr · Water, Category 2</Text>
        </Stack>
        <Inline gap={2}>
          <StatusPill tone="info" pulse>
            Drying, day 3
          </StatusPill>
          <Button>Generate report</Button>
        </Inline>
      </Inline>
      <Grid minChildWidth="16rem" gap={4}>
        {["Rooms 4", "Photos 48", "Readings 112", "Equipment 9"].map((stat) => (
          <Card key={stat}>
            <CardHeader title={stat} headingLevel={2} />
            <CardBody>
              <Text size="sm" tone="muted">
                Updated 2h ago
              </Text>
            </CardBody>
          </Card>
        ))}
      </Grid>
    </Stack>
  );
}

export const Default: Story = {
  render: (args) => (
    <AppShell {...args}>
      <ClaimPage />
    </AppShell>
  ),
};

export const Collapsed: Story = {
  args: { defaultCollapsed: true },
  render: (args) => (
    <AppShell {...args}>
      <ClaimPage />
    </AppShell>
  ),
};

/** Below 64rem the sidebar becomes a drawer opened from the menu button. */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: (args) => (
    <AppShell
      {...args}
      topbarEnd={<IconButton label="Notifications" icon={<Icon icon={Bell} />} />}
    >
      <ClaimPage />
    </AppShell>
  ),
};
