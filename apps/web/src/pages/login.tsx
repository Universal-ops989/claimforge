import { Stack } from "@claimforge/ui";

import { Page } from "../app/page";

/** Outside the signed-in layout: no navigation until someone signs in. */
export function LoginPage() {
  return (
    <Stack as="main" align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <Page title="Sign in" />
    </Stack>
  );
}
