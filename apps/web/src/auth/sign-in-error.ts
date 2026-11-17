import { isApiError, NetworkError } from "@claimforge/api-client";

/** What to tell someone whose sign-in failed. */
export function signInErrorMessage(error: unknown): string {
  if (isApiError(error, "invalid_credentials")) {
    return "That email and password don't match an account. Check them and try again.";
  }
  if (isApiError(error, "rate_limited")) {
    return "Too many sign-in attempts. Wait a minute, then try again.";
  }
  if (error instanceof NetworkError) {
    return "Couldn't reach ClaimForge. Check your connection and try again.";
  }
  return "Signing in didn't work. Try again in a moment.";
}
