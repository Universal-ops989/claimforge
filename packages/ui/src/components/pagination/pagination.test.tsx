import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getPageItems, Pagination } from "./pagination";

describe("getPageItems", () => {
  it("lists every page when they fit", () => {
    expect(getPageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it.each([
    [1, [1, 2, 3, 4, 5, "ellipsis-end", 20]],
    [4, [1, 2, 3, 4, 5, "ellipsis-end", 20]],
    [5, [1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 20]],
    [10, [1, "ellipsis-start", 9, 10, 11, "ellipsis-end", 20]],
    [17, [1, "ellipsis-start", 16, 17, 18, 19, 20]],
    [20, [1, "ellipsis-start", 16, 17, 18, 19, 20]],
  ])("page %i of 20", (page, expected) => {
    expect(getPageItems(page, 20)).toEqual(expected);
  });

  it("keeps a stable length and never repeats a page", () => {
    // With 2 siblings there are 9 slots; beyond 9 pages the length must stay at 9.
    for (let pageCount = 10; pageCount <= 40; pageCount += 1) {
      for (let page = 1; page <= pageCount; page += 1) {
        const items = getPageItems(page, pageCount, 2);
        const numbers = items.filter((i) => typeof i === "number");
        expect(items).toHaveLength(9);
        expect(new Set(numbers).size).toBe(numbers.length);
        expect(numbers).toContain(page);
      }
    }
  });
});

describe("Pagination", () => {
  it("marks the current page and changes pages", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={5} pageCount={20} onPageChange={onPageChange} />);

    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 5" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(screen.getByRole("button", { name: "Page 6" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(onPageChange.mock.calls).toEqual([[6], [6], [4]]);
  });

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = render(<Pagination page={1} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    rerender(<Pagination page={3} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("summarises the visible range", () => {
    render(
      <Pagination page={2} pageCount={13} pageSize={25} totalItems={312} onPageChange={vi.fn()} />,
    );

    expect(screen.getByText(/Showing/)).toHaveTextContent("Showing 26–50 of 312");
  });

  it("supports cursor mode", async () => {
    const onNext = vi.fn();
    render(
      <Pagination mode="cursor" hasPrevious={false} hasNext onPrevious={vi.fn()} onNext={onNext} />,
    );

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Page/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("changes page size", async () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        pageCount={5}
        onPageChange={vi.fn()}
        pageSize={25}
        pageSizeOptions={[10, 25, 50]}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Rows per page" }));
    await userEvent.click(await screen.findByRole("option", { name: "50" }));

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
