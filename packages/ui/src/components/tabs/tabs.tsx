import { clsx } from "clsx";
import { Tabs as RadixTabs } from "radix-ui";
import { createContext, use, type ComponentPropsWithRef, type ReactNode } from "react";

import styles from "./tabs.module.css";

type TabsVariant = "underline" | "pill";

const VariantContext = createContext<TabsVariant>("underline");

export interface TabsProps extends ComponentPropsWithRef<typeof RadixTabs.Root> {
  /** `underline` for page-level navigation, `pill` inside cards and panels. */
  variant?: TabsVariant;
}

/** Root. Use `value`/`onValueChange` to sync the active tab with the URL. */
export function Tabs({ variant = "underline", className, ...props }: TabsProps) {
  return (
    <VariantContext value={variant}>
      <RadixTabs.Root className={clsx(styles.root, className)} {...props} />
    </VariantContext>
  );
}

export type TabsListProps = ComponentPropsWithRef<typeof RadixTabs.List>;

export function TabsList({ className, ...props }: TabsListProps) {
  const variant = use(VariantContext);
  return <RadixTabs.List className={clsx(styles.list, styles[variant], className)} {...props} />;
}

export interface TabsTriggerProps extends ComponentPropsWithRef<typeof RadixTabs.Trigger> {
  /** Count shown after the label, e.g. number of photos. */
  count?: number;
  icon?: ReactNode;
}

export function TabsTrigger({ count, icon, className, children, ...props }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger className={clsx(styles.trigger, className)} {...props}>
      {icon != null && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
      {count !== undefined && (
        <>
          {/* A real space keeps the accessible name "Photos 48", not "Photos48". */}{" "}
          <span className={styles.count}>{count}</span>
        </>
      )}
    </RadixTabs.Trigger>
  );
}

export type TabsContentProps = ComponentPropsWithRef<typeof RadixTabs.Content>;

export function TabsContent({ className, ...props }: TabsContentProps) {
  return <RadixTabs.Content className={clsx(styles.content, className)} {...props} />;
}
