import { Spinner, Stack } from "@claimforge/ui";
import type { ComponentType } from "react";
import type { RouteObject } from "react-router";

import { ChooseOrganization } from "./app/organization";
import { RootLayout, ShellLayout } from "./app/root-layout";
import { RouteError } from "./app/route-error";
import type { ClaimTabHandle } from "./claims/detail/tabs";

/**
 * Every page, by address. Pages belong to an organization, named first by its slug, and
 * claims go by number, which is what people read out and paste:
 * `/lone-star/claims/2026-00042`. Claim numbers are only unique within an organization,
 * so a pasted link opens the claim meant, whichever organization the reader had open.
 * `/` goes on to an organization (`ChooseOrganization`).
 *
 * Each page's code loads when it's first opened (`lazy`); the layouts, which every screen
 * needs, arrive with the app.
 *
 * There's no catch-all route: an address nothing matches reaches `RouteError` as a 404,
 * the same way a loader's 404 does, so both show the not-found page.
 */
export const routes: RouteObject[] = [
  {
    path: "/login",
    lazy: page(
      () => import("./pages/login"),
      (module) => module.SignInPage,
    ),
    ErrorBoundary: RouteError,
    HydrateFallback: Loading,
  },
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: RouteError,
    HydrateFallback: Loading,
    children: [
      { index: true, Component: ChooseOrganization },
      {
        path: ":org",
        Component: ShellLayout,
        children: [
          {
            index: true,
            lazy: page(
              () => import("./pages/dashboard"),
              (module) => module.DashboardPage,
            ),
          },
          {
            path: "claims",
            children: [
              {
                index: true,
                lazy: page(
                  () => import("./pages/claims"),
                  (module) => module.ClaimsPage,
                ),
              },
              {
                path: "new",
                lazy: page(
                  () => import("./pages/new-claim"),
                  (module) => module.NewClaimPage,
                ),
              },
              {
                path: ":number",
                lazy: page(
                  () => import("./pages/claim"),
                  (module) => module.ClaimPage,
                ),
                // The claim's tabs (`CLAIM_TABS`), each in the address.
                children: [
                  {
                    index: true,
                    handle: { tab: "overview" } satisfies ClaimTabHandle,
                    lazy: page(
                      () => import("./claims/detail/overview-tab"),
                      (module) => module.OverviewTab,
                    ),
                  },
                  {
                    path: "timeline",
                    handle: { tab: "timeline" } satisfies ClaimTabHandle,
                    lazy: page(
                      () => import("./claims/detail/timeline-tab"),
                      (module) => module.TimelineTab,
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: "settings",
            lazy: page(
              () => import("./pages/settings"),
              (module) => module.SettingsPage,
            ),
          },
        ],
      },
    ],
  },
];

/** A lazy route whose page is `pick(module)`, the module loaded on first visit. */
function page<Module>(load: () => Promise<Module>, pick: (module: Module) => ComponentType) {
  return async () => ({ Component: pick(await load()) });
}

/** While the first page's code arrives. */
function Loading() {
  return (
    <Stack align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <Spinner label="Loading ClaimForge" />
    </Stack>
  );
}
