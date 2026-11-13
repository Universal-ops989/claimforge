import { clsx } from "clsx";
import { X } from "lucide-react";
import { Popover as RadixPopover } from "radix-ui";
import { useId, type ReactNode, type Ref } from "react";

import styles from "./popover.module.css";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverClose = RadixPopover.Close;
/** Position the popover against an element other than the trigger. */
export const PopoverAnchor = RadixPopover.Anchor;

export interface PopoverContentProps {
  /** Optional heading; also becomes the dialog's accessible name. */
  title?: ReactNode;
  /** Accessible name when there is no visible title. */
  "aria-label"?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  showArrow?: boolean;
  showCloseButton?: boolean;
  /** Width preset; content can still grow to its own min width. */
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Interactive floating panel anchored to its trigger. */
export function PopoverContent({
  title,
  "aria-label": ariaLabel,
  side = "bottom",
  align = "center",
  showArrow = false,
  showCloseButton = false,
  size = "md",
  className,
  children,
  ref,
}: PopoverContentProps) {
  const titleId = useId();

  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={8}
        aria-label={title == null ? ariaLabel : undefined}
        aria-labelledby={title != null ? titleId : undefined}
        className={clsx(styles.content, styles[size], className)}
      >
        {(title != null || showCloseButton) && (
          <div className={styles.header}>
            {title != null && (
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <RadixPopover.Close className={styles.close} aria-label="Close">
                <X aria-hidden="true" />
              </RadixPopover.Close>
            )}
          </div>
        )}
        {children}
        {showArrow && <RadixPopover.Arrow className={styles.arrow} width={12} height={6} />}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
