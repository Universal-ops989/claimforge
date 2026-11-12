import { clsx } from "clsx";
import { Slot } from "radix-ui";
import type { ComponentPropsWithRef, ReactNode } from "react";

import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  /** Visual emphasis. Use one `primary` button per view for the main action. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables interaction and sets `aria-busy`. Keeps the button's width. */
  loading?: boolean;
  /** Icon rendered before the label. */
  leadingIcon?: ReactNode;
  /** Icon rendered after the label. */
  trailingIcon?: ReactNode;
  /** Stretch to fill the container width. */
  fullWidth?: boolean;
  /**
   * Render the single child element (for example a router `Link`) with button styles
   * instead of a `<button>`.
   */
  asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  asChild = false,
  disabled,
  className,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = clsx(
    styles.root,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    className,
  );

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      // Default to "button" so buttons inside forms never submit by accident.
      type={type ?? "button"}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {leadingIcon != null && (
        <span className={styles.icon} aria-hidden="true">
          {leadingIcon}
        </span>
      )}
      <span className={styles.label}>{children}</span>
      {trailingIcon != null && (
        <span className={styles.icon} aria-hidden="true">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}
