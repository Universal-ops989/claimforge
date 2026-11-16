/**
 * Keeping a signed-in session alive.
 *
 * The API issues short-lived access tokens and rotating refresh tokens. Each refresh
 * replaces the refresh token, and presenting one that was already exchanged revokes the
 * whole session (reuse detection). So the one rule here: a given refresh token is
 * exchanged at most once. Concurrent calls share one refresh, a token someone else already
 * refreshed is picked up instead of exchanged again, and an optional lock extends the same
 * guarantee across browser tabs.
 */
import type { Schema } from "./index";

/** A signed-in session, in a shape any storage can keep (times are epoch milliseconds). */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

/** Where tokens live between calls. Sync or async, so localStorage and secure storage both fit. */
export interface TokenStore {
  get(): Tokens | null | Promise<Tokens | null>;
  set(tokens: Tokens | null): void | Promise<void>;
}

/** Runs `task` while holding a lock shared by everything that might refresh the same tokens. */
export type RefreshLock = <T>(task: () => Promise<T>) => Promise<T>;

export interface AuthOptions {
  tokens: TokenStore;
  /**
   * Called once when the session ends without the user signing out: the refresh token was
   * refused (expired, revoked or reused). The tokens are already cleared.
   */
  onSessionExpired?: () => void;
  /** Shared with other tabs or windows that use the same store; see `webLock()`. */
  lock?: RefreshLock;
  /** Refresh this many milliseconds before the access token expires. Default 30 seconds. */
  refreshMargin?: number;
  /** Clock for tests. */
  now?: () => number;
}

/** Keeps tokens for the life of the page. */
export function memoryTokenStore(initial: Tokens | null = null): TokenStore {
  let tokens = initial;
  return {
    get: () => tokens,
    set: (next) => {
      tokens = next;
    },
  };
}

/**
 * A lock across tabs using the Web Locks API, or `undefined` where it's missing (Node,
 * old browsers): then refreshes are still single-flight within the page.
 */
export function webLock(name = "claimforge:token-refresh"): RefreshLock | undefined {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  if (locks === undefined) {
    return undefined;
  }
  return async (task) => {
    // The lock is held until the task's promise settles; `request` resolves with its result.
    const result = await locks.request(name, task);
    return result;
  };
}

/** Tokens from a login or refresh answer, received at `now`. */
export function tokensFrom(answer: Schema<"TokenResponse">, now: number): Tokens {
  return {
    accessToken: answer.access_token,
    refreshToken: answer.refresh_token,
    accessExpiresAt: now + answer.expires_in * 1000,
    refreshExpiresAt: Date.parse(answer.refresh_expires_at),
  };
}

/** What the session needs from the client: exchange a refresh token, unauthenticated. */
export type Exchange = (refreshToken: string) => Promise<Schema<"TokenResponse">>;

/**
 * Thrown by an `Exchange` when the API refused the refresh token itself, as opposed to a
 * failure worth retrying later (network, 429, 5xx).
 */
export class RefreshRefused extends Error {
  override name = "RefreshRefused";
}

export const DEFAULT_REFRESH_MARGIN = 30_000;

export class Session {
  private inflight: Promise<Tokens | null> | null = null;
  private readonly store: TokenStore;
  private readonly lock: RefreshLock;
  private readonly margin: number;
  private readonly now: () => number;

  constructor(
    private readonly options: AuthOptions,
    private readonly exchange: Exchange,
  ) {
    this.store = options.tokens;
    this.lock = options.lock ?? ((task) => task());
    this.margin = options.refreshMargin ?? DEFAULT_REFRESH_MARGIN;
    this.now = options.now ?? Date.now;
  }

  /**
   * The tokens to send now, refreshed first when the access token is about to expire.
   * `null` when signed out. A refresh that fails for a passing reason falls back to the
   * current token and lets the API decide.
   */
  async current(): Promise<Tokens | null> {
    const tokens = await this.store.get();
    if (tokens === null || tokens.accessExpiresAt - this.now() > this.margin) {
      return tokens;
    }
    try {
      return await this.renew(tokens);
    } catch {
      return tokens;
    }
  }

  /**
   * Replace `stale` tokens the API no longer accepts. Resolves to the new tokens, or `null`
   * when the session is over. Rejects, keeping the tokens, when the refresh failed for a
   * passing reason.
   */
  renew(stale: Tokens): Promise<Tokens | null> {
    this.inflight ??= this.lock(async () => {
      const latest = await this.store.get();
      if (latest?.accessToken !== stale.accessToken) {
        return latest; // signed out, or refreshed by another call or tab meanwhile
      }
      return this.refresh(latest);
    }).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  async save(tokens: Tokens | null): Promise<void> {
    await this.store.set(tokens);
  }

  async tokens(): Promise<Tokens | null> {
    return this.store.get();
  }

  stamp(answer: Schema<"TokenResponse">): Tokens {
    return tokensFrom(answer, this.now());
  }

  private async refresh(tokens: Tokens): Promise<Tokens | null> {
    if (tokens.refreshExpiresAt <= this.now()) {
      return this.expire();
    }
    let answer: Schema<"TokenResponse">;
    try {
      answer = await this.exchange(tokens.refreshToken);
    } catch (error) {
      if (error instanceof RefreshRefused) {
        return this.expire();
      }
      throw error;
    }
    const renewed = this.stamp(answer);
    const latest = await this.store.get();
    if (latest?.refreshToken !== tokens.refreshToken) {
      return null; // signed out while the refresh was on its way: don't sign back in
    }
    await this.store.set(renewed);
    return renewed;
  }

  private async expire(): Promise<null> {
    await this.store.set(null);
    this.options.onSessionExpired?.();
    return null;
  }
}
