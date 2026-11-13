import { clsx } from "clsx";
import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode, Ref } from "react";

import styles from "./dialog.module.css";

export type DialogSize = "sm" | "md" | "lg" | "full";

/** Root: holds open state. Controlled with `open`/`onOpenChange` or uncontrolled. */
export const Dialog = RadixDialog.Root;

/** Wraps the element that opens the dialog. Use `asChild` with a Button. */
export const DialogTrigger = RadixDialog.Trigger;

/** Wraps any element that should close the dialog. Use `asChild` with a Button. */
export const DialogClose = RadixDialog.Close;

export interface DialogContentProps {
  /** Accessible name and visible heading. */
  title: ReactNode;
  description?: ReactNode;
  size?: DialogSize;
  /** Actions pinned to the bottom, typically Cancel + primary action. */
  footer?: ReactNode;
  /** Hide the corner close button (Escape and outside click still close). */
  hideCloseButton?: boolean;
  /**
   * Prevent closing on outside click, e.g. while a form has unsaved changes.
   * Escape and the close button still work.
   */
  disableOutsideClose?: boolean;
  className?: string;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function DialogContent({
  title,
  description,
  size = "md",
  footer,
  hideCloseButton = false,
  disableOutsideClose = false,
  className,
  children,
  ref,
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={styles.overlay} />
      <RadixDialog.Content
        ref={ref}
        className={clsx(styles.content, styles[size], className)}
        // Without a description, tell Radix explicitly so it does not warn.
        {...(description == null ? { "aria-describedby": undefined } : {})}
        onPointerDownOutside={(event) => {
          if (disableOutsideClose) event.preventDefault();
        }}
      >
        <header className={styles.header}>
          <div className={styles.titles}>
            <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
            {description != null && (
              <RadixDialog.Description className={styles.description}>
                {description}
              </RadixDialog.Description>
            )}
          </div>
          {!hideCloseButton && (
            <RadixDialog.Close className={styles.close} aria-label="Close">
              <X aria-hidden="true" />
            </RadixDialog.Close>
          )}
        </header>
        {children != null && <div className={styles.body}>{children}</div>}
        {footer != null && <footer className={styles.footer}>{footer}</footer>}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
