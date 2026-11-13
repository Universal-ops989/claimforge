import { clsx } from "clsx";
import type { HTMLAttributes, Ref } from "react";

import styles from "./text.module.css";

export type TextSize = "xs" | "sm" | "md" | "lg" | "xl";
export type TextWeight = "regular" | "medium" | "semibold" | "bold";
export type TextTone =
  "default" | "muted" | "subtle" | "accent" | "success" | "warning" | "danger" | "inherit";

export type TextElement = "p" | "span" | "div" | "label" | "strong" | "em" | "small" | "dd" | "dt";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  /** HTML element to render. Defaults to `span` so Text is safe inside any inline context. */
  as?: TextElement;
  size?: TextSize;
  weight?: TextWeight;
  tone?: TextTone;
  align?: "start" | "center" | "end";
  /** Clip to one line with an ellipsis. */
  truncate?: boolean;
  /** Clamp to a number of lines with an ellipsis. */
  lineClamp?: number;
  /** Use tabular figures so columns of numbers (readings, amounts) line up. */
  numeric?: boolean;
  /** For `as="label"`. */
  htmlFor?: string;
  ref?: Ref<HTMLElement>;
}

/** Body text with size, weight and tone from the type scale. */
export function Text({
  as = "span",
  size = "md",
  weight = "regular",
  tone = "default",
  align,
  truncate = false,
  lineClamp,
  numeric = false,
  className,
  style,
  ...props
}: TextProps) {
  // Every supported tag shares HTMLElement's props, so one tag type is enough for the checker.
  const Component = as as "span";

  return (
    <Component
      className={clsx(
        styles.root,
        styles[`size-${size}`],
        styles[`weight-${weight}`],
        styles[`tone-${tone}`],
        align && styles[`align-${align}`],
        truncate && styles.truncate,
        lineClamp !== undefined && styles.clamp,
        numeric && styles.numeric,
        className,
      )}
      style={lineClamp !== undefined ? { ...style, WebkitLineClamp: lineClamp } : style}
      {...props}
    />
  );
}
