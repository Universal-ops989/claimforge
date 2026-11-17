/**
 * Mock Service Worker support held to the API contract: `@claimforge/api-client/msw`.
 *
 * - `mockApi()`: typed handlers, checked against the contract (see handlers.ts).
 * - `createMockBackend()`: an in-memory API built from them (see backend.ts).
 */
export {
  mockApi,
  problem,
  type MockAnswer,
  type MockApi,
  type MockRequest,
  type MockResolver,
} from "./handlers";
export {
  createMockBackend,
  MOCK_PASSWORD,
  seedDb,
  type MockAccount,
  type MockBackend,
  type MockBackendOptions,
  type MockDb,
} from "./backend";
