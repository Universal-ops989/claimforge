import { clsx } from "clsx";
import type { ReactElement, ReactNode } from "react";

import { Tooltip } from "../tooltip/tooltip";
import { useAppShell } from "./app-shell";
import styles from "./app-shell.module.css";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
  /** Count badge, e.g. unread notifications or overdue readings. */
  badge?: number;
}

export interface NavSection {
  /** Optional section heading, hidden when the sidebar is collapsed. */
  label?: string;
  items: NavItem[];
}

export interface SidebarNavProps {
  sections: NavSection[];
  /**
   * Render links with your router. Receives the item, the class name to apply, the
   * content to render inside, and an `onClick` that must be called on navigation.
   */
  renderLink?: (args: {
    item: NavItem;
    className: string;
    children: ReactNode;
    onClick: () => void;
    "aria-current": "page" | undefined;
  }) => ReactElement;
}

/** Sectioned navigation list for the AppShell sidebar. */
export function SidebarNav({ sections, renderLink }: SidebarNavProps) {
  const { collapsed, onNavigate } = useAppShell();

  return (
    <div className={styles.sections}>
      {sections.map((section) => (
        <div key={section.label ?? section.items[0]?.href ?? "section"} className={styles.section}>
          {section.label != null && !collapsed && (
            <p className={styles.sectionLabel}>{section.label}</p>
          )}
          <ul className={styles.items}>
            {section.items.map((item) => {
              const className = clsx(styles.item, item.active === true && styles.active);
              const children = (
                <>
                  <span className={styles.itemIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={styles.itemLabel}>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={styles.itemBadge}>{item.badge > 99 ? "99+" : item.badge}</span>
                  )}
                </>
              );
              const ariaCurrent = item.active === true ? ("page" as const) : undefined;
              const link = renderLink ? (
                renderLink({
                  item,
                  className,
                  children,
                  onClick: onNavigate,
                  "aria-current": ariaCurrent,
                })
              ) : (
                <a
                  href={item.href}
                  className={className}
                  aria-current={ariaCurrent}
                  onClick={onNavigate}
                >
                  {children}
                </a>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip content={item.label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
