import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Pagination } from "./pagination";

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Numbered: Story = {
  args: { page: 5, pageCount: 20, onPageChange: () => undefined },
  render: function Render() {
    const [page, setPage] = useState(5);
    return <Pagination page={page} pageCount={20} onPageChange={setPage} />;
  },
};

/** Below a table: range summary, rows-per-page and page links. */
export const WithSummaryAndPageSize: Story = {
  args: { page: 1, pageCount: 1, onPageChange: () => undefined },
  render: function Render() {
    const total = 312;
    const [page, setPage] = useState(2);
    const [pageSize, setPageSize] = useState(25);
    const pageCount = Math.ceil(total / pageSize);
    return (
      <Pagination
        page={Math.min(page, pageCount)}
        pageCount={pageCount}
        onPageChange={setPage}
        totalItems={total}
        pageSize={pageSize}
        pageSizeOptions={[10, 25, 50, 100]}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    );
  },
};

/** For cursor-paginated API lists where the total isn't known. */
export const Cursor: Story = {
  args: {
    mode: "cursor",
    hasPrevious: true,
    hasNext: true,
    onPrevious: () => undefined,
    onNext: () => undefined,
  },
};
