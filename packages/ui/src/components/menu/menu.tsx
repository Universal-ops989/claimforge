import { clsx } from "clsx";
import { Check } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ComponentPropsWithRef, ReactNode } from "react";

import styles from "./menu.module.css";

export const Menu = DropdownMenu.Root;
/** Wraps the button that opens the menu. Use `asChild` with Button or IconButton. */
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;

export interface MenuContentProps extends ComponentPropsWithRef<typeof DropdownMenu.Content> {
  /** Minimum width; the menu also grows to fit its items. */
  minWidth?: string;
}

export function MenuContent({
  className,
  sideOffset = 4,
  align = "end",
  minWidth = "12rem",
  style,
  ...props
}: MenuContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={clsx(styles.content, className)}
        style={{ minWidth, ...style }}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

interface ItemDecorations {
  icon?: ReactNode;
  /** Shortcut hint shown at the end, e.g. "⌘D". Purely visual. */
  shortcut?: string;
}

export interface MenuItemProps
  extends ComponentPropsWithRef<typeof DropdownMenu.Item>, ItemDecorations {
  tone?: "default" | "danger";
}

export function MenuItem({
  icon,
  shortcut,
  tone = "default",
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={clsx(styles.item, tone === "danger" && styles.danger, className)}
      {...props}
    >
      <span className={styles.iconSlot} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.label}>{children}</span>
      {shortcut != null && (
        <span className={styles.shortcut} aria-hidden="true">
          {shortcut}
        </span>
      )}
    </DropdownMenu.Item>
  );
}

export type MenuCheckboxItemProps = ComponentPropsWithRef<typeof DropdownMenu.CheckboxItem> &
  Pick<ItemDecorations, "shortcut">;

/** Toggle item, e.g. for showing or hiding table columns. */
export function MenuCheckboxItem({
  shortcut,
  className,
  children,
  ...props
}: MenuCheckboxItemProps) {
  return (
    <DropdownMenu.CheckboxItem className={clsx(styles.item, className)} {...props}>
      <span className={styles.iconSlot} aria-hidden="true">
        <DropdownMenu.ItemIndicator>
          <Check />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className={styles.label}>{children}</span>
      {shortcut != null && (
        <span className={styles.shortcut} aria-hidden="true">
          {shortcut}
        </span>
      )}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({
  className,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={clsx(styles.groupLabel, className)} {...props} />;
}

export function MenuSeparator({
  className,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={clsx(styles.separator, className)} {...props} />;
}
