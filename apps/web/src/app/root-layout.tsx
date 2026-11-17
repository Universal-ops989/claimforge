import { AppShell, Text } from "@claimforge/ui";
import { Outlet } from "react-router";

import { RequireSession } from "../auth/session";
import { OrganizationLayout } from "./organization";
import { Navigation } from "./shell/navigation";
import { OrganizationSwitcher } from "./shell/organization-switcher";
import { UserMenu } from "./shell/user-menu";

const COLLAPSED_KEY = "claimforge.sidebar-collapsed";

/** Everything signed in sits under this; signed-out visitors are sent to sign in first. */
export function RootLayout() {
  return (
    <RequireSession>
      <Outlet />
    </RequireSession>
  );
}

/**
 * `/:org/*`: an organization's pages in the app shell (sidebar navigation, organization
 * switcher, top bar with the user menu, the `<main>` landmark).
 */
export function ShellLayout() {
  return (
    <OrganizationLayout>
      <AppShell
        brand={<Text weight="bold">ClaimForge</Text>}
        navigation={<Navigation />}
        sidebarFooter={<OrganizationSwitcher />}
        topbarEnd={<UserMenu />}
        defaultCollapsed={readCollapsed()}
        onCollapsedChange={writeCollapsed}
      >
        <Outlet />
      </AppShell>
    </OrganizationLayout>
  );
}

/** Whether the sidebar was left collapsed in this browser; a per-viewer convenience. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // Not remembered; nothing else depends on it.
  }
}
