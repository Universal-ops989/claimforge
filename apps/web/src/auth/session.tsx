import type { Tokens } from "@claimforge/api-client";
import { createContext, use, useSyncExternalStore, type ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";

import { loginPathFor, safeNextPath } from "./next-path";
import type { SessionStore } from "./session-store";

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({ store, children }: { store: SessionStore; children: ReactNode }) {
  return <SessionContext value={store}>{children}</SessionContext>;
}

/** The current session's tokens, or `null` when signed out; re-renders when it changes. */
export function useSession(): Tokens | null {
  const store = use(SessionContext);
  if (!store) {
    throw new Error("useSession() needs a <SessionProvider> above it");
  }
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Show `children` to a signed-in user; send anyone else to sign in, and back here after. */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const { pathname, search, hash } = useLocation();
  if (!session) {
    return <Navigate to={loginPathFor(`${pathname}${search}${hash}`)} replace />;
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
