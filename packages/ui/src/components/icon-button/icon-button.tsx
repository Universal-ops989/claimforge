import { clsx } from "clsx";
import type { ReactNode } from "react";

import { Button, type ButtonProps } from "../button/button";
import styles from "./icon-button.module.css";

export interface IconButtonProps extends Omit<
  ButtonProps,
  "children" | "leadingIcon" | "trailingIcon" | "fullWidth" | "asChild"
> {
  /** The icon to show. It is decorative; `label` provides the accessible name. */
  icon: ReactNode;
  /** Required accessible name, e.g. "Delete photo". Also used as the native tooltip. */
  label: string;
  /** Show the native browser tooltip from `label`. Turn off when wrapping in `Tooltip`. */
  showTitle?: boolean;
}

/** A square button that contains only an icon. */
export function IconButton({
  icon,
  label,
  showTitle = true,
  variant = "ghost",
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      aria-label={label}
      title={showTitle ? label : undefined}
      className={clsx(styles.root, className)}
      {...props}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    </Button>
  );
}
