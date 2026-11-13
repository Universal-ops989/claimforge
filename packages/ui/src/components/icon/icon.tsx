import { clsx } from "clsx";
import type { LucideIcon, LucideProps } from "lucide-react";

import styles from "./icon.module.css";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Any lucide icon component (e.g. `import { Camera } from "lucide-react"`). */
export type IconComponent = LucideIcon;

export interface IconProps extends Omit<LucideProps, "size" | "ref"> {
  /** The icon to render. */
  icon: IconComponent;
  size?: IconSize;
  /**
   * Accessible name. Without it the icon is decorative and hidden from assistive
   * technology, which is right whenever text next to it already says the same thing.
   */
  label?: string;
}

/** Renders an icon at a consistent size and stroke, decorative unless labelled. */
export function Icon({ icon: IconSvg, size = "md", label, className, ...props }: IconProps) {
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);

  return (
    <IconSvg
      className={clsx(styles.root, styles[size], className)}
      strokeWidth={2}
      focusable="false"
      {...a11y}
      {...props}
    />
  );
}
