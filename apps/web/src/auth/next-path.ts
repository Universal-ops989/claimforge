const HOME = "/";
const ORIGIN = "https://claimforge.invalid";

/**
 * Where to go after signing in, from `?next=`: only a path inside the app. Anything that
 * could leave it (`//evil.test`, `https://evil.test`, `/\evil.test`, `javascript:`) and the
 * sign-in page itself fall back to the dashboard, so a crafted link can't use the sign-in
 * page to send someone elsewhere.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw?.startsWith("/")) {
    return HOME;
  }
  let url: URL;
  try {
    url = new URL(raw, ORIGIN);
  } catch {
    return HOME;
  }
  // `//evil.test` and `/\evil.test` parse as another host: the origin check catches both.
  if (url.origin !== ORIGIN || url.pathname === "/login") {
    return HOME;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/login?next=…` for coming back to `path` after signing in. */
export function loginPathFor(path: string): string {
  const next = safeNextPath(path);
  return next === HOME ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
