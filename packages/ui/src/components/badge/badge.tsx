import { clsx } from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";

import styles from "./badge.module.css";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends ComponentPropsWithRef<"span"> {
  tone?: BadgeTone;
  /** `subtle` (tinted background) for most uses; `solid` for high emphasis. */
  emphasis?: "subtle" | "solid";
  size?: "sm" | "md";
  /** Decorative icon before the text. */
  icon?: ReactNode;
}

/** A short label for counts, categories and attributes, e.g. "Cat 2" or "12 photos". */
export function Badge({
  tone = "neutral",
  emphasis = "subtle",
  size = "md",
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={clsx(styles.root, styles[tone], styles[emphasis], styles[size], className)}
      {...props}
    >
      {icon != null && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

export interface StatusPillProps extends Omit<BadgeProps, "icon" | "emphasis"> {
  /** Animate the dot for live or in-progress states. */
  pulse?: boolean;
}

/** A badge with a status dot, for workflow states like "Drying in progress". */
export function StatusPill({ pulse = false, children, className, ...props }: StatusPillProps) {
  return (
    <Badge
      {...props}
      emphasis="subtle"
      className={clsx(styles.pill, className)}
      icon={<span className={clsx(styles.dot, pulse && styles.pulse)} />}
    >
      {children}
    </Badge>
  );
}
