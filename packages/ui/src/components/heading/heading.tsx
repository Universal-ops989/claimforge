import { clsx } from "clsx";
import type { HTMLAttributes, Ref } from "react";

import styles from "./heading.module.css";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const DEFAULT_SIZE: Record<HeadingLevel, HeadingSize> = {
  1: "2xl",
  2: "xl",
  3: "lg",
  4: "md",
  5: "sm",
  6: "xs",
};

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /**
   * Semantic level (h1–h6). Pick it from the document outline, not from how big
   * the text should look; use `size` for that.
   */
  level?: HeadingLevel;
  /** Visual size. Defaults to a size that matches the level. */
  size?: HeadingSize;
  tone?: "default" | "muted";
  truncate?: boolean;
  ref?: Ref<HTMLHeadingElement>;
}

export function Heading({
  level = 2,
  size,
  tone = "default",
  truncate = false,
  className,
  ...props
}: HeadingProps) {
  const Tag = `h${level}` as const;

  return (
    <Tag
      className={clsx(
        styles.root,
        styles[`size-${size ?? DEFAULT_SIZE[level]}`],
        tone === "muted" && styles.muted,
        truncate && styles.truncate,
        className,
      )}
      {...props}
    />
  );
}
