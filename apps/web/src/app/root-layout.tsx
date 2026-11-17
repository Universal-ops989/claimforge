import { Outlet } from "react-router";

import { RequireSession } from "../auth/session";

/**
 * What every signed-in page sits in; signed-out visitors are sent to sign in first. The
 * app shell (navigation, org switcher) comes in item 101.
 */
export function RootLayout() {
  return (
    <RequireSession>
      <main style={{ padding: "var(--cf-space-6)" }}>
        <Outlet />
      </main>
    </RequireSession>
  );
}
