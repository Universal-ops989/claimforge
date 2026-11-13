import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { clsx } from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";

import { Checkbox } from "../checkbox/checkbox";
import styles from "./data-table.module.css";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match TanStack's generics
  interface ColumnMeta<TData, TValue> {
    /** Horizontal alignment; use "end" for numbers and amounts. */
    align?: "start" | "center" | "end";
    /** Fixed CSS width, e.g. "8rem". */
    width?: string;
  }

  interface TableMeta<TData extends RowData> {
    getRowLabel?: (row: TData) => string;
  }
}

/**
 * Column definitions. Value types differ per column, which TanStack models with `any`;
 * define columns with `createColumnHelper<T>()` to keep each one fully typed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
export type DataTableColumn<T> = ColumnDef<T, any>;

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** Describes the table for assistive tech. */
  caption: string;
  /** Show the caption visually as well. */
  showCaption?: boolean;
  /** Stable row id (defaults to the index). Required for reliable selection. */
  getRowId?: (row: T) => string;
  /** Human label for a row, used in selection checkbox labels. */
  getRowLabel?: (row: T) => string;

  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Data is sorted by the server; headers only report sort changes. */
  manualSorting?: boolean;

  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;

  /** Called when a row is clicked outside its interactive controls. */
  onRowClick?: (row: T) => void;
  loading?: boolean;
  loadingRows?: number;
  emptyState?: ReactNode;
  density?: "comfortable" | "compact";
  className?: string;
}

const INTERACTIVE =
  "a, button, input, select, textarea, label, [role='checkbox'], [role='menuitem']";

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  const IconComponent =
    direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <IconComponent
      aria-hidden="true"
      className={clsx(styles.sortIcon, direction === false && styles.sortIconIdle)}
    />
  );
}

/*
 * Selection header and cell are module-level components on purpose: flexRender treats
 * functions as component types, so defining them inline would remount the checkboxes
 * on every render and drop keyboard focus.
 */
function SelectAllHeader<T>({ table }: HeaderContext<T, unknown>) {
  return (
    <Checkbox
      aria-label="Select all rows"
      checked={
        table.getIsAllRowsSelected()
          ? true
          : table.getIsSomeRowsSelected()
            ? "indeterminate"
            : false
      }
      onCheckedChange={(checked) => {
        table.toggleAllRowsSelected(checked === true);
      }}
    />
  );
}

function SelectRowCell<T>({ row, table }: CellContext<T, unknown>) {
  const label = table.options.meta?.getRowLabel?.(row.original) ?? `row ${String(row.index + 1)}`;
  return (
    <Checkbox
      aria-label={`Select ${label}`}
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onCheckedChange={(checked) => {
        row.toggleSelected(checked === true);
      }}
    />
  );
}

const selectionColumn = <T,>(): DataTableColumn<T> => ({
  id: "__select",
  enableSorting: false,
  meta: { width: "2.75rem" },
  header: SelectAllHeader,
  cell: SelectRowCell,
});

/** Accessible data table with sorting, selection, loading and empty states. */
export function DataTable<T>({
  data,
  columns,
  caption,
  showCaption = false,
  getRowId,
  getRowLabel,
  sorting: sortingProp,
  onSortingChange,
  manualSorting = false,
  enableRowSelection = false,
  rowSelection: rowSelectionProp,
  onRowSelectionChange,
  onRowClick,
  loading = false,
  loadingRows = 5,
  emptyState = "No results",
  density = "comfortable",
  className,
}: DataTableProps<T>) {
  // TanStack Table returns new functions every render by design, which the React
  // Compiler cannot memoize safely, so this component opts out of compilation.
  "use no memo";

  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});

  const allColumns = useMemo(
    () => (enableRowSelection ? [selectionColumn<T>(), ...columns] : columns),
    [enableRowSelection, columns],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- intentional: this component opts out via "use no memo"
  const table = useReactTable({
    data,
    columns: allColumns,
    meta: { getRowLabel },
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    state: {
      sorting: sortingProp ?? internalSorting,
      rowSelection: rowSelectionProp ?? internalSelection,
    },
    onSortingChange: onSortingChange ?? setInternalSorting,
    onRowSelectionChange: onRowSelectionChange ?? setInternalSelection,
    enableRowSelection,
    manualSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
  });

  const columnCount = table.getVisibleLeafColumns().length;

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: Row<T>) => {
    if (!onRowClick) return;
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    onRowClick(row.original);
  };

  return (
    <div className={clsx(styles.wrapper, className)}>
      <table className={clsx(styles.table, styles[density])} aria-busy={loading || undefined}>
        <caption className={clsx(styles.caption, !showCaption && styles.hiddenCaption)}>
          {caption}
        </caption>
        <thead className={styles.head}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sorted = header.column.getIsSorted();
                const content = header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <th
                    key={header.id}
                    scope="col"
                    style={{ width: meta?.width }}
                    className={clsx(styles.th, meta?.align && styles[`align-${meta.align}`])}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {content}
                        <SortIcon direction={sorted} />
                      </button>
                    ) : (
                      content
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }, (_, i) => (
              <tr key={`loading-${String(i)}`} className={styles.row}>
                {Array.from({ length: columnCount }, (__, j) => (
                  <td key={j} className={styles.td}>
                    <span className={styles.skeleton} />
                  </td>
                ))}
              </tr>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className={styles.empty}>
                {emptyState}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={clsx(styles.row, onRowClick && styles.clickable)}
                data-selected={row.getIsSelected() || undefined}
                onClick={(event) => {
                  handleRowClick(event, row);
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <td
                      key={cell.id}
                      className={clsx(styles.td, meta?.align && styles[`align-${meta.align}`])}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { createColumnHelper } from "@tanstack/react-table";
export type { RowSelectionState, SortingState } from "@tanstack/react-table";
