import { clsx } from "clsx";
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { createContext, use, useState, type ReactNode } from "react";

import styles from "./app-shell.module.css";

interface ShellContextValue {
  /** Sidebar shows icons only. Never true inside the mobile drawer. */
  collapsed: boolean;
  /** Called after a navigation item is chosen (closes the mobile drawer). */
  onNavigate: () => void;
}

const ShellContext = createContext<ShellContextValue>({
  collapsed: false,
  onNavigate: () => undefined,
});

/** Read the sidebar state from navigation components. */
export const useAppShell = () => use(ShellContext);

export interface AppShellProps {
  /** Logo or product name at the top of the sidebar. */
  brand: ReactNode;
  /** Usually a `SidebarNav`. Rendered in the sidebar and in the mobile drawer. */
  navigation: ReactNode;
  /** Bottom of the sidebar, e.g. the signed-in user or org switcher. */
  sidebarFooter?: ReactNode;
  /** Left side of the top bar, e.g. breadcrumbs or the page title. */
  topbarStart?: ReactNode;
  /** Right side of the top bar, e.g. search, notifications and the user menu. */
  topbarEnd?: ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Accessible name of the primary navigation landmark. */
  navigationLabel?: string;
  children: ReactNode;
}

/** Application frame: sidebar navigation, top bar and main content. */
export function AppShell({
  brand,
  navigation,
  sidebarFooter,
  topbarStart,
  topbarEnd,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  navigationLabel = "Main",
  children,
}: AppShellProps) {
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsed = collapsedProp ?? uncontrolledCollapsed;

  const toggleCollapsed = () => {
    setUncontrolledCollapsed(!collapsed);
    onCollapsedChange?.(!collapsed);
  };

  return (
    <div className={clsx(styles.shell, collapsed && styles.collapsed)}>
      <a href="#main" className={styles.skipLink}>
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>{brand}</div>
        <ShellContext value={{ collapsed, onNavigate: () => undefined }}>
          <nav aria-label={navigationLabel} className={styles.nav}>
            {navigation}
          </nav>
          {sidebarFooter != null && <div className={styles.footer}>{sidebarFooter}</div>}
        </ShellContext>
        <button
          type="button"
          className={styles.collapseButton}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          {/* Mobile navigation drawer */}
          <RadixDialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <RadixDialog.Trigger className={styles.menuButton} aria-label="Open navigation">
              <MenuIcon aria-hidden="true" />
            </RadixDialog.Trigger>
            <RadixDialog.Portal>
              <RadixDialog.Overlay className={styles.drawerOverlay} />
              <RadixDialog.Content className={styles.drawer} aria-describedby={undefined}>
                <div className={styles.drawerHeader}>
                  <RadixDialog.Title className={styles.drawerTitle}>{brand}</RadixDialog.Title>
                  <RadixDialog.Close className={styles.menuButton} aria-label="Close navigation">
                    <X aria-hidden="true" />
                  </RadixDialog.Close>
                </div>
                <ShellContext
                  value={{
                    collapsed: false,
                    onNavigate: () => {
                      setDrawerOpen(false);
                    },
                  }}
                >
                  <nav aria-label={navigationLabel} className={styles.nav}>
                    {navigation}
                  </nav>
                  {sidebarFooter != null && <div className={styles.footer}>{sidebarFooter}</div>}
                </ShellContext>
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>

          <div className={styles.topbarStart}>{topbarStart}</div>
          <div className={styles.topbarEnd}>{topbarEnd}</div>
        </header>

        <main id="main" tabIndex={-1} className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
