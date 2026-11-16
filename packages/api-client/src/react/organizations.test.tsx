// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Schema } from "../index";
import {
  allItems,
  queryKeys,
  useCreateInvitation,
  useCreateOrganization,
  useDeleteOrganization,
  useInvitations,
  useMe,
  useOrganization,
  useOrganizations,
  useRevokeInvitation,
  useUpdateOrganization,
} from "./index";
import { FakeServer, json, me, noContent, ORG_ID, problem, renderWithApi } from "./testing";

afterEach(cleanup);

const OTHER_ID = "0198a2c4-7b1e-7cc0-8000-0000000000a2";

function organization(id: string, name: string): Schema<"OrganizationRead"> {
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    timezone: "America/Chicago",
    default_tax_percent: "8.25",
    default_overhead_percent: "10",
    default_profit_percent: "10",
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-01T12:00:00Z",
  };
}

function invitation(n: number): Schema<"InvitationRead"> {
  return {
    id: `0198a2c4-7b1e-7cc0-8000-0000000000c${String(n)}`,
    email: `person${String(n)}@example.com`,
    role: "technician",
    created_at: "2026-11-16T12:00:00Z",
    expires_at: "2026-11-23T12:00:00Z",
  };
}

function page(items: Schema<"OrganizationRead">[], next: string | null) {
  return { items, next_cursor: next, has_more: next !== null };
}

const count = (calls: string[], prefix: string) =>
  calls.filter((call) => call.startsWith(prefix)).length;

describe("organizations", () => {
  test("pages through the list", async () => {
    const server = new FakeServer().on("GET", "/v1/organizations", (request) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      return json(
        cursor === null
          ? page([organization(ORG_ID, "Lone Star")], "c1")
          : page([organization(OTHER_ID, "Gulf Coast")], null),
      );
    });

    const { result } = renderWithApi(() => useOrganizations({ limit: 1 }), { server });
    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
    await act(() => result.current.fetchNextPage());

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(false);
    });
    expect(allItems(result.current.data).map((org) => org.name)).toEqual([
      "Lone Star",
      "Gulf Coast",
    ]);
    expect(server.calls).toEqual([
      "GET /v1/organizations?limit=1 access-1",
      "GET /v1/organizations?limit=1&cursor=c1 access-1",
    ]);
  });

  test("creating one seeds its detail and refreshes lists and /v1/me", async () => {
    const created = organization(OTHER_ID, "Gulf Coast");
    const server = new FakeServer()
      .on("GET", "/v1/organizations", () => json(page([], null)))
      .on("GET", "/v1/me", () => json(me()))
      .on("POST", "/v1/organizations", () => json(created, 201));
    const { result, queryClient } = renderWithApi(
      () => ({ list: useOrganizations(), me: useMe(), create: useCreateOrganization() }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess && result.current.me.isSuccess).toBe(true);
    });

    await act(() => result.current.create.mutateAsync({ name: "Gulf Coast" }));

    expect(queryClient.getQueryData(queryKeys.organization(OTHER_ID))).toEqual(created);
    expect(count(server.calls, "GET /v1/organizations")).toBe(2);
    expect(count(server.calls, "GET /v1/me")).toBe(2);
    expect(count(server.calls, `GET /v1/organizations/${OTHER_ID}`)).toBe(0); // no refetch needed
  });

  test("updating one replaces its detail in place", async () => {
    const server = new FakeServer()
      .on("GET", `/v1/organizations/${ORG_ID}`, () => json(organization(ORG_ID, "Lone Star")))
      .on("PATCH", `/v1/organizations/${ORG_ID}`, () =>
        json(organization(ORG_ID, "Lone Star Restoration")),
      );
    const { result } = renderWithApi(
      () => ({ detail: useOrganization(ORG_ID), update: useUpdateOrganization(ORG_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.detail.data?.name).toBe("Lone Star");
    });

    await act(() => result.current.update.mutateAsync({ name: "Lone Star Restoration" }));

    await waitFor(() => {
      expect(result.current.detail.data?.name).toBe("Lone Star Restoration");
    });
    expect(count(server.calls, `GET /v1/organizations/${ORG_ID}`)).toBe(1); // no refetch
  });

  test("deleting one drops everything cached under it", async () => {
    const server = new FakeServer()
      .on("GET", "/v1/me", () => json(me()))
      .on("DELETE", `/v1/organizations/${ORG_ID}`, noContent);
    const { result, queryClient } = renderWithApi(() => useDeleteOrganization(), { server });
    queryClient.setQueryData(queryKeys.organization(ORG_ID), organization(ORG_ID, "Lone Star"));
    queryClient.setQueryData(queryKeys.invitations(ORG_ID), [invitation(1)]);
    queryClient.setQueryData(queryKeys.organization(OTHER_ID), organization(OTHER_ID, "Gulf"));

    await act(() => result.current.mutateAsync(ORG_ID));

    expect(queryClient.getQueryData(queryKeys.organization(ORG_ID))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.invitations(ORG_ID))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.organization(OTHER_ID))).toBeDefined();
  });
});

describe("invitations", () => {
  test("a new invitation goes on top, then the list refreshes", async () => {
    let pending = [invitation(1)];
    const server = new FakeServer()
      .on("GET", `/v1/organizations/${ORG_ID}/invitations`, () => json(pending))
      .on("POST", `/v1/organizations/${ORG_ID}/invitations`, () => {
        pending = [invitation(2), ...pending];
        return json(invitation(2), 201);
      });
    const { result } = renderWithApi(
      () => ({ list: useInvitations(ORG_ID), invite: useCreateInvitation(ORG_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });

    await act(() =>
      result.current.invite.mutateAsync({ email: "person2@example.com", role: "technician" }),
    );

    await waitFor(() => {
      expect(result.current.list.data?.map((i) => i.email)).toEqual([
        "person2@example.com",
        "person1@example.com",
      ]);
    });
    expect(count(server.calls, "GET /v1/organizations")).toBe(2);
  });

  test("revoking hides the invitation at once", async () => {
    let answered = false;
    let answer: () => void = () => undefined;
    const server = new FakeServer()
      .on("GET", `/v1/organizations/${ORG_ID}/invitations`, () =>
        json(answered ? [invitation(2)] : [invitation(1), invitation(2)]),
      )
      .on(
        "DELETE",
        `/v1/organizations/${ORG_ID}/invitations/${invitation(1).id}`,
        () =>
          new Promise((resolve) => {
            answer = () => {
              answered = true;
              resolve(noContent());
            };
          }),
      );
    const { result } = renderWithApi(
      () => ({ list: useInvitations(ORG_ID), revoke: useRevokeInvitation(ORG_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });

    act(() => {
      result.current.revoke.mutate(invitation(1).id);
    });

    await waitFor(() => {
      expect(result.current.list.data?.map((i) => i.id)).toEqual([invitation(2).id]);
    });
    expect(result.current.revoke.isPending).toBe(true); // before the API has answered
    act(() => {
      answer();
    });
    await waitFor(() => {
      expect(result.current.revoke.isSuccess).toBe(true);
    });
    expect(result.current.list.data?.map((i) => i.id)).toEqual([invitation(2).id]);
  });

  test("a refused revoke puts the invitation back", async () => {
    const server = new FakeServer()
      .on("GET", `/v1/organizations/${ORG_ID}/invitations`, () =>
        json([invitation(1), invitation(2)]),
      )
      .on("DELETE", `/v1/organizations/${ORG_ID}/invitations/${invitation(1).id}`, () =>
        problem(403, "permission_denied"),
      );
    const { result } = renderWithApi(
      () => ({ list: useInvitations(ORG_ID), revoke: useRevokeInvitation(ORG_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
    });

    await act(async () => {
      await result.current.revoke.mutateAsync(invitation(1).id).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.revoke.error).toMatchObject({ code: "permission_denied" });
    });
    expect(result.current.list.data?.map((i) => i.id)).toEqual([
      invitation(1).id,
      invitation(2).id,
    ]);
  });
});
