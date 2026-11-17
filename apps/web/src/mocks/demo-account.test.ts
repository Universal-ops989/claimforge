import { createMockBackend, MOCK_PASSWORD } from "@claimforge/api-client/msw";
import { expect, test } from "vitest";

import { DEMO_ACCOUNT } from "./demo-account";

test("the demo account is one the mock backend signs in", () => {
  const backend = createMockBackend({ baseUrl: "https://api.test" });

  expect(DEMO_ACCOUNT.password).toBe(MOCK_PASSWORD);
  expect(backend.db.accounts.map((account) => account.email)).toContain(DEMO_ACCOUNT.email);
});
