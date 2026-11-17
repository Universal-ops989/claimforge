import type { Schema } from "@claimforge/api-client";
import { useMe } from "@claimforge/api-client/react";
import { Button, EmptyState, Spinner, Stack } from "@claimforge/ui";
import { createContext, use, type ReactNode } from "react";
import { Navigate, Outlet, useParams } from "react-router";

import { useSignOut } from "../auth/session";
import { PageTitle } from "./page-title";
import { NotFound } from "./route-error";

export type Membership = Schema<"MeResponse">["memberships"][number];

/** The organization a page belongs to, with the user's role and permissions in it. */
export interface CurrentOrganization {
  id: string;
  name: string;
  slug: string;
  role: Membership["role"];
  permissions: Membership["permissions"];
}

const OrganizationContext = createContext<CurrentOrganization | null>(null);

/** The organization in the address. Only inside `OrganizationLayout`. */
export function useOrganization(): CurrentOrganization {
  const organization = use(OrganizationContext);
  if (!organization) {
    throw new Error("useOrganization() is only available under /:org");
  }
  return organization;
}

const LAST_KEY = "claimforge.organization";

function rememberOrganization(slug: string): void {
  try {
    localStorage.setItem(LAST_KEY, slug);
  } catch {
    // Not remembered: `/` falls back to the first organization.
  }
}

function lastOrganization(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

/** The address of `path` (e.g. "claims") in the organization `slug`. */
export function inOrganization(slug: string, path = ""): string {
  return `/${slug}${path ? `/${path}` : ""}`;
}

function Loading() {
  return (
    <Stack align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <Spinner label="Loading your organizations" />
    </Stack>
  );
}

/** `/`: on to the organization used last here, or the first one. */
export function ChooseOrganization() {
  const me = useMe();
  if (!me.data) {
    if (me.isError) throw me.error;
    return <Loading />;
  }
  const memberships = me.data.memberships;
  if (memberships.length === 0) {
    return <NoOrganization />;
  }
  const last = lastOrganization();
  const chosen = memberships.find((m) => m.organization.slug === last) ?? memberships[0];
  return <Navigate to={inOrganization(chosen?.organization.slug ?? "")} replace />;
}

/** `/:org/*`: the organization in the address, for everything under it. */
export function OrganizationLayout({ children }: { children?: ReactNode }) {
  const { org = "" } = useParams();
  const me = useMe();
  if (!me.data) {
    if (me.isError) throw me.error;
    return <Loading />;
  }
  const membership = me.data.memberships.find((m) => m.organization.slug === org);
  if (!membership) {
    return <NotFound />;
  }
  rememberOrganization(org);
  const current: CurrentOrganization = {
    ...membership.organization,
    role: membership.role,
    permissions: membership.permissions,
  };
  return <OrganizationContext value={current}>{children ?? <Outlet />}</OrganizationContext>;
}

function NoOrganization() {
  const { signOut } = useSignOut();
  return (
    <Stack as="main" align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <PageTitle title="No organization yet" />
      <EmptyState
        headingLevel={1}
        title="You're not in an organization yet"
        description="ClaimForge works inside an organization. Ask someone who manages yours to invite you; the invitation arrives by email."
        actions={
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        }
      />
    </Stack>
  );
}
