import type { Meta, StoryObj } from "@storybook/react-vite";
import { Camera, ClipboardList, Droplets, FileText, Home, Receipt } from "lucide-react";

import { Card, CardBody } from "../card/card";
import { Text } from "../text/text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const SECTIONS = [
  { value: "overview", label: "Overview", icon: <Home /> },
  { value: "rooms", label: "Rooms", icon: <ClipboardList />, count: 4 },
  { value: "photos", label: "Photos", icon: <Camera />, count: 48 },
  { value: "readings", label: "Readings", icon: <Droplets />, count: 112 },
  { value: "estimate", label: "Estimate", icon: <Receipt /> },
  { value: "reports", label: "Reports", icon: <FileText />, count: 2 },
];

/** Page-level navigation on the claim detail page. */
export const ClaimSections: Story = {
  render: () => (
    <Tabs defaultValue="photos">
      <TabsList aria-label="Claim sections">
        {SECTIONS.map((section) => (
          <TabsTrigger
            key={section.value}
            value={section.value}
            icon={section.icon}
            count={section.count}
          >
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {SECTIONS.map((section) => (
        <TabsContent key={section.value} value={section.value}>
          <Text tone="muted">{section.label} content</Text>
        </TabsContent>
      ))}
    </Tabs>
  ),
};

export const Pills: Story = {
  render: () => (
    <Card style={{ maxWidth: 480 }}>
      <CardBody>
        <Tabs variant="pill" defaultValue="wall">
          <TabsList aria-label="Material">
            <TabsTrigger value="wall">Walls</TabsTrigger>
            <TabsTrigger value="floor">Floors</TabsTrigger>
            <TabsTrigger value="ceiling">Ceilings</TabsTrigger>
          </TabsList>
          <TabsContent value="wall">
            <Text size="sm">Drywall: 4 points, average 16%</Text>
          </TabsContent>
          <TabsContent value="floor">
            <Text size="sm">Subfloor: 6 points, average 21%</Text>
          </TabsContent>
          <TabsContent value="ceiling">
            <Text size="sm">No readings yet</Text>
          </TabsContent>
        </Tabs>
      </CardBody>
    </Card>
  ),
};

/** On narrow screens the tab list scrolls horizontally instead of wrapping. */
export const Narrow: Story = {
  ...ClaimSections,
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
