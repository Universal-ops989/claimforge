// @vitest-environment jsdom
import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { agentContact, claimContact, contact } from "../fixtures";
import {
  queryKeys,
  useClaim,
  useContacts,
  useLinkContact,
  useUnlinkContact,
  useUpdateContact,
} from "./index";
import {
  claim,
  CLAIM_ID,
  FakeServer,
  json,
  noContent,
  ORG_ID,
  problem,
  renderWithApi,
} from "./testing";

afterEach(cleanup);

const CLAIM = `/v1/organizations/${ORG_ID}/claims/${CLAIM_ID}`;
const CONTACTS = `/v1/organizations/${ORG_ID}/contacts`;
const casey = agentContact();
const page = (items: unknown[]) => json({ items, next_cursor: null, has_more: false });

describe("the address book", () => {
  test("useContacts asks with the search", async () => {
    const server = new FakeServer().on("GET", CONTACTS, () => page([casey]));
    const { result } = renderWithApi(() => useContacts(ORG_ID, { q: "brooks" }), { server });

    await waitFor(() => {
      expect(result.current.data?.pages[0]?.items).toEqual([casey]);
    });
    expect(server.calls[0]).toMatch(/\?q=brooks/);
  });

  test("changing a contact refreshes the claims that carry it", async () => {
    let claimGets = 0;
    const server = new FakeServer()
      .on("GET", CLAIM, () => {
        claimGets += 1;
        return json(claim({ contacts: [claimContact()] }));
      })
      .on("PATCH", `${CONTACTS}/${contact().id}`, () => json(contact({ phone: "+15125550177" })));
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), update: useUpdateContact(ORG_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.data).toBeDefined();
    });

    await act(() =>
      result.current.update.mutateAsync({ contactId: contact().id, phone: "512 555 0177" }),
    );

    await waitFor(() => {
      expect(claimGets).toBe(2);
    });
  });
});

describe("contacts on a claim", () => {
  test("linking a primary contact demotes the last one in the cached claim", async () => {
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim({ contacts: [claimContact()] })))
      .on("POST", `${CLAIM}/contacts`, () =>
        json({ contact: casey, role: "insurance_agent", is_primary: true }, 201),
      );
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), link: useLinkContact(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.data).toBeDefined();
    });

    await act(() =>
      result.current.link.mutateAsync({
        contact_id: casey.id,
        role: "insurance_agent",
        is_primary: true,
      }),
    );

    await waitFor(() => {
      expect(
        result.current.claim.data?.contacts.map((c) => [c.contact.full_name, c.is_primary]),
      ).toEqual([
        ["Jordan Rivera", false],
        ["Casey Brooks", true],
      ]);
    });
  });

  test("unlinking shows at once, and is undone if refused", async () => {
    let answer: (response: Response) => void = () => undefined;
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim({ contacts: [claimContact()] })))
      .on(
        "DELETE",
        `${CLAIM}/contacts/${contact().id}`,
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      );
    const { result, queryClient } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), unlink: useUnlinkContact(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.data?.contacts).toHaveLength(1);
    });

    act(() => {
      result.current.unlink.mutate(contact().id);
    });
    await waitFor(() => {
      expect(
        queryClient.getQueryData<{ contacts: unknown[] }>(queryKeys.claim(ORG_ID, CLAIM_ID))
          ?.contacts,
      ).toEqual([]);
    });
    answer(problem(409, "claim_locked"));

    await waitFor(() => {
      expect(result.current.unlink.isError).toBe(true);
    });
    expect(result.current.claim.data?.contacts).toHaveLength(1);
  });

  test("an unlink the API takes stays done", async () => {
    const server = new FakeServer()
      .on("GET", CLAIM, () => json(claim({ contacts: [] })))
      .on("DELETE", `${CLAIM}/contacts/${contact().id}`, () => noContent());
    const { result } = renderWithApi(
      () => ({ claim: useClaim(ORG_ID, CLAIM_ID), unlink: useUnlinkContact(ORG_ID, CLAIM_ID) }),
      { server },
    );
    await waitFor(() => {
      expect(result.current.claim.data).toBeDefined();
    });

    await act(() => result.current.unlink.mutateAsync(contact().id));

    await waitFor(() => {
      expect(result.current.unlink.isSuccess).toBe(true);
    });
    expect(result.current.claim.data?.contacts).toEqual([]);
  });
});
