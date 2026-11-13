import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";

import { Avatar } from "../avatar/avatar";
import { StatusPill, type BadgeTone } from "../badge/badge";
import { Button } from "../button/button";
import { Icon } from "../icon/icon";
import { IconButton } from "../icon-button/icon-button";
import { Inline, Stack } from "../layout/layout";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../menu/menu";
import { Text } from "../text/text";
import { VisuallyHidden } from "../visually-hidden/visually-hidden";
import { createColumnHelper, DataTable, type RowSelectionState } from "./data-table";

interface ClaimRow {
  id: string;
  insured: string;
  address: string;
  status: { label: string; tone: BadgeTone };
  adjuster: string;
  lossDate: string;
  reserve: number;
}

const CLAIMS: ClaimRow[] = [
  {
    id: "CF-1042",
    insured: "Maria Rivera",
    address: "1428 Maple Grove Dr",
    status: { label: "Drying", tone: "info" },
    adjuster: "Dana Whitfield",
    lossDate: "2026-11-02",
    reserve: 18_400,
  },
  {
    id: "CF-1043",
    insured: "Kevin Chen",
    address: "77 Harbor View Rd",
    status: { label: "Estimate review", tone: "warning" },
    adjuster: "Marcus Lee",
    lossDate: "2026-10-28",
    reserve: 4_250,
  },
  {
    id: "CF-1044",
    insured: "Ruth Abbott",
    address: "9 Orchard Lane",
    status: { label: "Closed", tone: "success" },
    adjuster: "Dana Whitfield",
    lossDate: "2026-10-11",
    reserve: 9_900,
  },
  {
    id: "CF-1045",
    insured: "Omar Haddad",
    address: "312 Ridge Ct",
    status: { label: "New", tone: "neutral" },
    adjuster: "Priya Raman",
    lossDate: "2026-11-10",
    reserve: 32_000,
  },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const col = createColumnHelper<ClaimRow>();

const COLUMNS = [
  col.accessor("id", {
    header: "Claim",
    cell: (info) => (
      <a href={`#${info.getValue()}`} style={{ fontWeight: 600, color: "inherit" }}>
        {info.getValue()}
      </a>
    ),
  }),
  col.accessor("insured", {
    header: "Insured",
    cell: (info) => (
      <Stack gap={0}>
        <Text size="sm">{info.getValue()}</Text>
        <Text size="xs" tone="muted">
          {info.row.original.address}
        </Text>
      </Stack>
    ),
  }),
  col.accessor((row) => row.status.label, {
    id: "status",
    header: "Status",
    cell: (info) => <StatusPill tone={info.row.original.status.tone}>{info.getValue()}</StatusPill>,
  }),
  col.accessor("adjuster", {
    header: "Adjuster",
    cell: (info) => (
      <Inline gap={2} wrap={false}>
        <Avatar name={info.getValue()} size="xs" />
        <Text size="sm">{info.getValue()}</Text>
      </Inline>
    ),
  }),
  col.accessor("lossDate", { header: "Loss date" }),
  col.accessor("reserve", {
    header: "Reserve",
    meta: { align: "end" },
    cell: (info) => money.format(info.getValue()),
  }),
  col.display({
    id: "actions",
    header: () => <VisuallyHidden>Actions</VisuallyHidden>,
    meta: { width: "3rem" },
    cell: (info) => (
      <Menu>
        <MenuTrigger asChild>
          <IconButton
            size="sm"
            label={`Actions for ${info.row.original.id}`}
            icon={<Icon icon={MoreHorizontal} />}
          />
        </MenuTrigger>
        <MenuContent>
          <MenuItem>Assign</MenuItem>
          <MenuItem>Export</MenuItem>
          <MenuItem tone="danger">Delete</MenuItem>
        </MenuContent>
      </Menu>
    ),
  }),
];

const meta = {
  title: "Components/DataTable",
  component: DataTable<ClaimRow>,
  parameters: { layout: "padded" },
  args: { caption: "Open claims", data: CLAIMS, columns: COLUMNS, onRowClick: fn() },
  argTypes: { data: { control: false }, columns: { control: false } },
} satisfies Meta<typeof DataTable<ClaimRow>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click headers to sort; click a row (outside its link and menu) to open it. */
export const ClaimsList: Story = {};

export const WithSelection: Story = {
  render: function Render(args) {
    const [selection, setSelection] = useState<RowSelectionState>({});
    const count = Object.keys(selection).length;
    return (
      <Stack gap={3}>
        <Inline justify="between">
          <Text size="sm" tone="muted">
            {count > 0 ? `${String(count)} selected` : "Select claims to bulk-assign"}
          </Text>
          <Button size="sm" disabled={count === 0}>
            Assign selected
          </Button>
        </Inline>
        <DataTable
          {...args}
          enableRowSelection
          getRowId={(row) => row.id}
          getRowLabel={(row) => `${row.id}, ${row.insured}`}
          rowSelection={selection}
          onRowSelectionChange={setSelection}
        />
      </Stack>
    );
  },
};

export const Compact: Story = { args: { density: "compact" } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: {
    data: [],
    emptyState: (
      <Stack gap={1} align="center">
        <Text weight="medium">No claims match these filters</Text>
        <Text size="sm" tone="muted">
          Try widening the loss date range.
        </Text>
      </Stack>
    ),
  },
};
