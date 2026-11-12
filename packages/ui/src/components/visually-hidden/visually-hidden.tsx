import { clsx } from "clsx";
import type { ComponentPropsWithRef } from "react";

import styles from "./visually-hidden.module.css";

export type VisuallyHiddenProps = ComponentPropsWithRef<"span">;

/**
 * Hides content visually while keeping it available to screen readers.
 * Use for icon-only controls and extra context that sighted users get from layout.
 */
export function VisuallyHidden({ className, ...props }: VisuallyHiddenProps) {
  return <span className={clsx(styles.root, className)} {...props} />;
}
