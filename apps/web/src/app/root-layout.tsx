import { useMe } from "@claimforge/api-client/react";
import { Button, Inline, Text } from "@claimforge/ui";
import { Outlet } from "react-router";

import { RequireSession, useSignOut } from "../auth/session";

/**
 * What every signed-in page sits in; signed-out visitors are sent to sign in first. The
 * app shell (navigation, org switcher) replaces the top bar in item 101.
 */
export function RootLayout() {
  return (
    <RequireSession>
      <TopBar />
      <main style={{ padding: "var(--cf-space-6)" }}>
        <Outlet />
      </main>
    </RequireSession>
  );
}

function TopBar() {
  const me = useMe();
  const { signOut, isPending } = useSignOut();
  return (
    <Inline
      as="header"
      justify="between"
      align="center"
      style={{
        padding: "var(--cf-space-3) var(--cf-space-6)",
        borderBottom: "1px solid var(--cf-color-border)",
      }}
    >
      <Text weight="semibold">ClaimForge</Text>
      <Inline gap={3} align="center">
        {me.data && <Text tone="muted">{me.data.full_name}</Text>}
        <Button variant="ghost" size="sm" loading={isPending} onClick={signOut}>
          Sign out
        </Button>
      </Inline>
    </Inline>
  );
}
