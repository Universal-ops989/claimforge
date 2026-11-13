import { clsx } from "clsx";
import type { CSSProperties } from "react";

import styles from "./skeleton.module.css";

export interface SkeletonProps {
  shape?: "text" | "circle" | "rect";
  /** Any CSS length. Defaults to 100% (text/rect) or the height (circle). */
  width?: string | number;
  /** Any CSS length. Defaults depend on the shape. */
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}

const toLength = (value: string | number | undefined) =>
  typeof value === "number" ? `${String(value)}px` : value;

/**
 * Placeholder shaped like the content that is loading. Decorative: announce loading
 * once on the container (e.g. `aria-busy` on a table) rather than per skeleton.
 */
export function Skeleton({ shape = "text", width, height, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={clsx(styles.root, styles[shape], className)}
      style={{
        ...style,
        width: toLength(width) ?? (shape === "circle" ? toLength(height) : undefined),
        height: toLength(height),
      }}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** Several text lines; the last one is shorter, like a real paragraph. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className={clsx(styles.lines, className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 && lines > 1 ? "60%" : "100%"} />
      ))}
    </span>
  );
}
