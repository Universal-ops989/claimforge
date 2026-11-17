import { AppShell, Text } from "@claimforge/ui";
import { Outlet } from "react-router";

import { RequireSession } from "../auth/session";
import { Navigation } from "./shell/navigation";
import { UserMenu } from "./shell/user-menu";

const COLLAPSED_KEY = "claimforge.sidebar-collapsed";

/**
 * What every signed-in page sits in: the app shell (sidebar navigation, top bar with the
 * user menu, the `<main>` landmark). Signed-out visitors are sent to sign in first.
 */
export function RootLayout() {
  return (
    <RequireSession>
      <AppShell
        brand={<Text weight="bold">ClaimForge</Text>}
        navigation={<Navigation />}
        topbarEnd={<UserMenu />}
        defaultCollapsed={readCollapsed()}
        onCollapsedChange={writeCollapsed}
      >
        <Outlet />
      </AppShell>
    </RequireSession>
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
