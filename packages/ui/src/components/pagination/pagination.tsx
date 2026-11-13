import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Select } from "../select/select";
import styles from "./pagination.module.css";

export type PageItem = number | "ellipsis-start" | "ellipsis-end";

/**
 * Pages to show for `page` of `pageCount`: always the first and last page, `siblings`
 * pages on each side of the current one, and ellipses for gaps. The result has a stable
 * length (2 * siblings + 5) once there are enough pages, so the control does not jump.
 */
export function getPageItems(page: number, pageCount: number, siblings = 1): PageItem[] {
  const totalSlots = siblings * 2 + 5;
  if (pageCount <= totalSlots) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  // Sibling window, clamped so it never collides with the first/last page slots.
  const start = Math.max(Math.min(page - siblings, pageCount - 2 - siblings * 2), 3);
  const end = Math.min(Math.max(page + siblings, 3 + siblings * 2), pageCount - 2);
  const middle = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return [
    1,
    // A gap of exactly one page shows that page instead of an ellipsis.
    start > 3 ? "ellipsis-start" : 2,
    ...middle,
    end < pageCount - 2 ? "ellipsis-end" : pageCount - 1,
    pageCount,
  ];
}

interface BaseProps {
  /** Accessible name for the navigation landmark. */
  label?: string;
  className?: string;
  /** Total items, for the "Showing x–y of z" summary. */
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export interface NumberedPaginationProps extends BaseProps {
  mode?: "numbered";
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  siblings?: number;
}

export interface CursorPaginationProps extends BaseProps {
  mode: "cursor";
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export type PaginationProps = NumberedPaginationProps | CursorPaginationProps;

function Summary({
  page,
  pageSize,
  totalItems,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
}) {
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <p className={styles.summary}>
      Showing <strong>{fmt(first)}</strong>–<strong>{fmt(last)}</strong> of{" "}
      <strong>{fmt(totalItems)}</strong>
    </p>
  );
}

function StepButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const IconComponent = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      className={clsx(styles.button, styles.step)}
      disabled={disabled}
      onClick={onClick}
    >
      {direction === "previous" && <IconComponent aria-hidden="true" />}
      {direction === "previous" ? "Previous" : "Next"}
      {direction === "next" && <IconComponent aria-hidden="true" />}
    </button>
  );
}

/** Navigate between pages of a list. Numbered or cursor-based. */
export function Pagination(props: PaginationProps) {
  const {
    label = "Pagination",
    className,
    totalItems,
    pageSize,
    pageSizeOptions,
    onPageSizeChange,
  } = props;

  return (
    <div className={clsx(styles.root, className)}>
      {props.mode !== "cursor" && totalItems !== undefined && pageSize !== undefined && (
        <Summary page={props.page} pageSize={pageSize} totalItems={totalItems} />
      )}

      <div className={styles.controls}>
        {pageSizeOptions && pageSize !== undefined && onPageSizeChange && (
          <div className={styles.pageSize}>
            <span aria-hidden="true">Rows</span>
            <Select
              size="sm"
              aria-label="Rows per page"
              value={String(pageSize)}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
              }}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
        )}

        <nav aria-label={label}>
          <ul className={styles.list}>
            {props.mode === "cursor" ? (
              <>
                <li>
                  <StepButton
                    direction="previous"
                    disabled={!props.hasPrevious}
                    onClick={props.onPrevious}
                  />
                </li>
                <li>
                  <StepButton direction="next" disabled={!props.hasNext} onClick={props.onNext} />
                </li>
              </>
            ) : (
              <>
                <li>
                  <StepButton
                    direction="previous"
                    disabled={props.page <= 1}
                    onClick={() => {
                      props.onPageChange(props.page - 1);
                    }}
                  />
                </li>
                {getPageItems(props.page, props.pageCount, props.siblings).map((item) =>
                  typeof item === "number" ? (
                    <li key={item}>
                      <button
                        type="button"
                        className={clsx(styles.button, styles.page)}
                        aria-current={item === props.page ? "page" : undefined}
                        aria-label={`Page ${String(item)}`}
                        onClick={() => {
                          props.onPageChange(item);
                        }}
                      >
                        {item}
                      </button>
                    </li>
                  ) : (
                    <li key={item} className={styles.ellipsis} aria-hidden="true">
                      …
                    </li>
                  ),
                )}
                <li>
                  <StepButton
                    direction="next"
                    disabled={props.page >= props.pageCount}
                    onClick={() => {
                      props.onPageChange(props.page + 1);
                    }}
                  />
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}
