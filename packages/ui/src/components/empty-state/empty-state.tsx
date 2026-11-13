import { clsx } from "clsx";
import type { ReactNode } from "react";

import { Heading, type HeadingLevel } from "../heading/heading";
import styles from "./empty-state.module.css";

export interface EmptyStateProps {
  /** Decorative illustration or icon. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary and secondary actions, e.g. "New claim" and "Import". */
  actions?: ReactNode;
  headingLevel?: HeadingLevel;
  /** `compact` for inside cards and table bodies. */
  size?: "compact" | "default";
  className?: string;
}

/** Explains why there's nothing to show and what to do next. */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  headingLevel = 3,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div className={clsx(styles.root, styles[size], className)}>
      {icon != null && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <Heading level={headingLevel} size={size === "compact" ? "sm" : "md"}>
        {title}
      </Heading>
      {description != null && <p className={styles.description}>{description}</p>}
      {actions != null && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
