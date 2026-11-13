import { clsx } from "clsx";
import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode, Ref } from "react";

import styles from "./drawer.module.css";

/** Root: holds open state. Same API as `Dialog`. */
export const Drawer = RadixDialog.Root;
export const DrawerTrigger = RadixDialog.Trigger;
export const DrawerClose = RadixDialog.Close;

export interface DrawerContentProps {
  title: ReactNode;
  description?: ReactNode;
  side?: "right" | "left";
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  /** Extra controls in the header, before the close button. */
  headerActions?: ReactNode;
  className?: string;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Side sheet that slides over the page; focus is trapped while it is open. */
export function DrawerContent({
  title,
  description,
  side = "right",
  size = "md",
  footer,
  headerActions,
  className,
  children,
  ref,
}: DrawerContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className={styles.overlay} />
      <RadixDialog.Content
        ref={ref}
        className={clsx(styles.content, styles[side], styles[size], className)}
        {...(description == null ? { "aria-describedby": undefined } : {})}
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
          <div className={styles.headerActions}>
            {headerActions}
            <RadixDialog.Close className={styles.close} aria-label="Close">
              <X aria-hidden="true" />
            </RadixDialog.Close>
          </div>
        </header>
        <div className={styles.body}>{children}</div>
        {footer != null && <footer className={styles.footer}>{footer}</footer>}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
