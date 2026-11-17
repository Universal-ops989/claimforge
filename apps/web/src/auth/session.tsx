import type { Tokens } from "@claimforge/api-client";
import { useLogout } from "@claimforge/api-client/react";
import { createContext, use, useSyncExternalStore, type ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";

import { loginPathFor, safeNextPath } from "./next-path";
import type { SessionStore } from "./session-store";

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({ store, children }: { store: SessionStore; children: ReactNode }) {
  return <SessionContext value={store}>{children}</SessionContext>;
}

function useSessionStore(): SessionStore {
  const store = use(SessionContext);
  if (!store) {
    throw new Error("useSession() needs a <SessionProvider> above it");
  }
  return store;
}

/** The current session's tokens, or `null` when signed out; re-renders when it changes. */
export function useSession(): Tokens | null {
  const store = useSessionStore();
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** What the sign-in page is told when the session ended without the user signing out. */
export interface SignInState {
  sessionEnded?: boolean;
}

/**
 * Sign out: revoke the session at the API and forget every cached query. The sign-in
 * page follows (through `RequireSession`), without a message: the user chose this.
 */
export function useSignOut() {
  const store = useSessionStore();
  const logout = useLogout();
  return {
    signOut: () => {
      store.expectSignOut();
      logout.mutate();
    },
    isPending: logout.isPending,
  };
}

/** Show `children` to a signed-in user; send anyone else to sign in, and back here after. */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const store = useSessionStore();
  const { pathname, search, hash } = useLocation();
  if (!session) {
    // Signing out starts over; a session that ended on its own comes back here after.
    if (store.endedBy() === "sign-out") {
      return <Navigate to="/login" replace />;
    }
    const state: SignInState = { sessionEnded: store.endedBy() === "ended" };
    return <Navigate to={loginPathFor(`${pathname}${search}${hash}`)} state={state} replace />;
  }
  return children;
}

/** Show `children` (the sign-in page) only to someone signed out; send others on. */
export function RequireNoSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const [params] = useSearchParams();
  if (session) {
    return <Navigate to={safeNextPath(params.get("next"))} replace />;
  }
  return children;
}
