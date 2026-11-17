/**
 * The mock backend's account the sign-in page offers in mock mode (the demo). Spelled out
 * here, not imported from `@claimforge/api-client/msw`, so the sign-in page doesn't pull
 * the mock into every build; a test keeps the two in step.
 */
export const DEMO_ACCOUNT = {
  email: "morgan@example.com",
  password: "correct horse battery staple",
} as const;
