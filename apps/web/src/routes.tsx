import type { RouteObject } from "react-router";

import { ChooseOrganization } from "./app/organization";
import { RootLayout, ShellLayout } from "./app/root-layout";
import { RouteError } from "./app/route-error";
import { RequireNoSession } from "./auth/session";
import { ClaimPage } from "./pages/claim";
import { ClaimsPage } from "./pages/claims";
import { DashboardPage } from "./pages/dashboard";
import { LoginPage } from "./pages/login";
import { NewClaimPage } from "./pages/new-claim";
import { SettingsPage } from "./pages/settings";

/**
 * Every page, by address. Pages belong to an organization, named first by its slug, and
 * claims go by number, which is what people read out and paste:
 * `/lone-star/claims/2026-00042`. Claim numbers are only unique within an organization,
 * so a pasted link opens the claim meant, whichever organization the reader had open.
 * `/` goes on to an organization (`ChooseOrganization`).
 *
 * There's no catch-all route: an address nothing matches reaches `RouteError` as a 404,
 * the same way a loader's 404 does, so both show the not-found page.
 */
export const routes: RouteObject[] = [
  { path: "/login", Component: SignIn, ErrorBoundary: RouteError },
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: ChooseOrganization },
      {
        path: ":org",
        Component: ShellLayout,
        children: [
          { index: true, Component: DashboardPage },
          {
            path: "claims",
            children: [
              { index: true, Component: ClaimsPage },
              { path: "new", Component: NewClaimPage },
              { path: ":number", Component: ClaimPage },
            ],
          },
          { path: "settings", Component: SettingsPage },
        ],
      },
    ],
  },
];

/** The sign-in page, for someone signed out; anyone else goes on. */
function SignIn() {
  return (
    <RequireNoSession>
      <LoginPage />
    </RequireNoSession>
  );
}
