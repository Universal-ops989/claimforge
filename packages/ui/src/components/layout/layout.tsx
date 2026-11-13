import { clsx } from "clsx";
import type { CSSProperties, HTMLAttributes, Ref } from "react";

import { space, type SpaceToken } from "../../tokens";
import styles from "./layout.module.css";

type LayoutElement =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "header"
  | "footer"
  | "nav"
  | "ul"
  | "ol"
  | "li"
  | "form"
  | "main";

type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify = "start" | "center" | "end" | "between" | "around";

interface BaseLayoutProps extends HTMLAttributes<HTMLElement> {
  as?: LayoutElement;
  /** Space between children, from the spacing scale. */
  gap?: SpaceToken;
  ref?: Ref<HTMLElement>;
}

const JUSTIFY: Record<Justify, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

const ALIGN: Record<Align, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

function cssVars(vars: Record<string, string | undefined>, style?: CSSProperties) {
  return { ...vars, ...style };
}

export interface StackProps extends BaseLayoutProps {
  align?: Align;
  justify?: Justify;
}

/** Vertical layout: children stacked top to bottom with consistent spacing. */
export function Stack({
  as = "div",
  gap = 4,
  align = "stretch",
  justify = "start",
  className,
  style,
  ref,
  ...props
}: StackProps) {
  // All layout tags accept the same props; type-check against one of them.
  const Component = as as "div";
  return (
    <Component
      ref={ref as Ref<HTMLDivElement>}
      className={clsx(styles.stack, className)}
      style={cssVars(
        {
          "--layout-gap": space[gap],
          "--layout-align": ALIGN[align],
          "--layout-justify": JUSTIFY[justify],
        },
        style,
      )}
      {...props}
    />
  );
}

export interface InlineProps extends BaseLayoutProps {
  align?: Align;
  justify?: Justify;
  /** Wrap onto new lines when out of space. On by default. */
  wrap?: boolean;
}

/** Horizontal layout: children in a row, wrapping when needed. */
export function Inline({
  as = "div",
  gap = 2,
  align = "center",
  justify = "start",
  wrap = true,
  className,
  style,
  ref,
  ...props
}: InlineProps) {
  // All layout tags accept the same props; type-check against one of them.
  const Component = as as "div";
  return (
    <Component
      ref={ref as Ref<HTMLDivElement>}
      className={clsx(styles.inline, !wrap && styles.nowrap, className)}
      style={cssVars(
        {
          "--layout-gap": space[gap],
          "--layout-align": ALIGN[align],
          "--layout-justify": JUSTIFY[justify],
        },
        style,
      )}
      {...props}
    />
  );
}

export interface GridProps extends BaseLayoutProps {
  /** Fixed number of equal columns. */
  columns?: number;
  /**
   * Responsive alternative to `columns`: fit as many columns as possible
   * that are at least this wide (any CSS length, e.g. "16rem").
   */
  minChildWidth?: string;
}

/** Two-dimensional grid with equal columns. */
export function Grid({
  as = "div",
  gap = 4,
  columns,
  minChildWidth,
  className,
  style,
  ref,
  ...props
}: GridProps) {
  // All layout tags accept the same props; type-check against one of them.
  const Component = as as "div";
  const template = minChildWidth
    ? `repeat(auto-fill, minmax(min(${minChildWidth}, 100%), 1fr))`
    : `repeat(${String(columns ?? 1)}, minmax(0, 1fr))`;

  return (
    <Component
      ref={ref as Ref<HTMLDivElement>}
      className={clsx(styles.grid, className)}
      style={cssVars({ "--layout-gap": space[gap], "--layout-columns": template }, style)}
      {...props}
    />
  );
}
