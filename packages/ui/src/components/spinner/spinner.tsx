import { clsx } from "clsx";

import styles from "./spinner.module.css";

export interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * Announced to screen readers. Pass `null` when the spinner sits inside something
   * that already communicates loading (e.g. a busy button), to keep it decorative.
   */
  label?: string | null;
  className?: string;
}

/** Indeterminate progress indicator. Inherits the current text color. */
export function Spinner({ size = "md", label = "Loading", className }: SpinnerProps) {
  const ring = <span className={clsx(styles.ring, styles[size])} aria-hidden="true" />;

  if (label === null) {
    return <span className={clsx(styles.root, className)}>{ring}</span>;
  }

  return (
    <span role="status" className={clsx(styles.root, className)}>
      {ring}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
