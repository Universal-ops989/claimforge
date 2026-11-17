import { Outlet } from "react-router";

/** What every signed-in page sits in. The app shell (navigation, org switcher) comes in item 101. */
export function RootLayout() {
  return (
    <main style={{ padding: "var(--cf-space-6)" }}>
      <Outlet />
    </main>
  );
}
