// @vitest-environment jsdom
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { ids } from "../fixtures";
import { createApiClient, memoryTokenStore } from "../index";
import {
  ApiProvider,
  createQueryClient,
  useChangeClaimStatus,
  useClaim,
  usePhotos,
  useUploadPhoto,
} from "../react";
import { createMockBackend, MOCK_PASSWORD } from "./index";

const backend = createMockBackend({ baseUrl: "https://api.test" });
const server = setupServer(...backend.handlers);

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  cleanup();
  backend.reset();
});
afterAll(() => {
  server.close();
});

async function signedInClient(email: string) {
  const api = createApiClient({
    baseUrl: "https://api.test",
    auth: { tokens: memoryTokenStore() },
  });
  await api.login({ email, password: MOCK_PASSWORD });
  return api;
}

test("the hooks, client and mock backend work together: a teammate's move wins", async () => {
  const api = await signedInClient("morgan@example.com");
  const queryClient = createQueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      claim: useClaim(ids.organization, ids.claim),
      change: useChangeClaimStatus(ids.organization, ids.claim),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(result.current.claim.data?.status).toBe("new");
  });

  // A teammate, on another device, moves the claim first.
  const teammate = await signedInClient("morgan@example.com");
  await teammate.post("/v1/organizations/{organization_id}/claims/{claim_id}/status", {
    path: { organization_id: ids.organization, claim_id: ids.claim },
    body: { status: "inspected" },
  });

  await act(async () => {
    await result.current.change.mutateAsync({ status: "in_progress" }).catch(() => undefined);
  });

  await waitFor(() => {
    expect(result.current.claim.data?.status).toBe("inspected");
  });
  expect(result.current.change.error).toMatchObject({ status: 409, code: "status_changed" });
  expect(backend.db.claims.find((c) => c.claim.id === ids.claim)?.claim.status).toBe("inspected");
});

test("a photo uploads through the hook, the signed link and the pretend store", async () => {
  const api = await signedInClient("riley@example.com");
  const queryClient = createQueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider client={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      photos: usePhotos(ids.organization, ids.claim),
      upload: useUploadPhoto(ids.organization, ids.claim),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(result.current.photos.data?.pages[0]?.items).toHaveLength(1);
  });

  const file = new File([new Uint8Array(512)], "IMG_2.jpg", { type: "image/jpeg" });
  await act(() => result.current.upload.mutateAsync({ file, tags: ["after"] }));

  await waitFor(() => {
    expect(result.current.photos.data?.pages[0]?.items.map((p) => p.filename)).toEqual([
      "IMG_2.jpg",
      "IMG_0412.jpg",
    ]);
  });
  const sent = await fetch(result.current.photos.data?.pages[0]?.items[0]?.url ?? "");
  expect((await sent.blob()).size).toBe(512);
});
