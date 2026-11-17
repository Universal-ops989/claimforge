import type { Tokens, TokenStore } from "@claimforge/api-client";

/** The session's tokens, kept where reloads and other tabs can find them. */
export interface SessionStore extends TokenStore {
  get: () => Tokens | null;
  set: (tokens: Tokens | null) => void;
  /** Called after every change, from this tab or another; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
}

export const SESSION_KEY = "claimforge.session";

/**
 * A session store backed by `storage` (normally `localStorage`; `null` keeps it in memory).
 *
 * Other tabs share the storage, and their changes arrive as `storage` events: this tab
 * takes them up at once. That matters beyond showing the right page: the API revokes a
 * refresh token presented twice, so a tab must never refresh with a token another tab has
 * already exchanged. Storage that refuses to be used (private browsing, blocked site
 * data) leaves the session in memory for the tab's lifetime.
 */
export function createSessionStore(
  storage: Storage | null,
  key: string = SESSION_KEY,
  events: Pick<Window, "addEventListener"> | null = typeof window === "undefined" ? null : window,
): SessionStore {
  const listeners = new Set<() => void>();
  let current = read(storage, key);

  const notify = () => {
    for (const listener of listeners) listener();
  };

  if (storage) {
    events?.addEventListener("storage", (event) => {
      // `key === null` means the other tab cleared all of storage.
      if (event.storageArea === storage && (event.key === key || event.key === null)) {
        current = event.key === null ? null : parse(event.newValue);
        notify();
      }
    });
  }

  return {
    get: () => current,
    set: (tokens) => {
      current = tokens;
      try {
        if (tokens) storage?.setItem(key, JSON.stringify(tokens));
        else storage?.removeItem(key);
      } catch {
        // Storage refused: the session lives on in memory for this tab.
      }
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function read(storage: Storage | null, key: string): Tokens | null {
  try {
    return parse(storage?.getItem(key) ?? null);
  } catch {
    return null;
  }
}

/** Tokens from stored text; `null` for nothing, corrupt data or anything else. */
function parse(text: string | null): Tokens | null {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt } = value as Record<
    string,
    unknown
  >;
  return typeof accessToken === "string" &&
    typeof refreshToken === "string" &&
    typeof accessExpiresAt === "number" &&
    typeof refreshExpiresAt === "number"
    ? { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt }
    : null;
}
