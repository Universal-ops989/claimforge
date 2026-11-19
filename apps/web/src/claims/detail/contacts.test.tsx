import { agentContact, ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const CLAIM = "/lone-star/claims/2026-00042";

type User = ReturnType<typeof userEvent.setup>;

function seededClaim() {
  const seeded = backend.db.claims.find((c) => c.claim.id === ids.claim);
  if (!seeded) throw new Error("no seeded claim");
  return seeded.claim;
}

const card = async () => within(await screen.findByRole("region", { name: "Contacts" }));
const names = async () =>
  (await card())
    .getAllByRole("listitem")
    .map((item) => within(item).getAllByText(/./)[0]?.textContent);

async function openAdd(user: User) {
  await renderApp(CLAIM, { signedInAs: "morgan@example.com" });
  await user.click((await card()).getByRole("button", { name: "Add contact" }));
  return within(await screen.findByRole("dialog", { name: "Add a contact" }));
}

async function chooseRole(user: User, role: string) {
  await user.click(screen.getByRole("combobox", { name: /^Their part in the claim/ }));
  await user.click(await screen.findByRole("option", { name: role }));
}

describe("the contacts", () => {
  test("say who to reach, their part, and how", async () => {
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    const jordan = (await card()).getByRole("listitem");
    expect(jordan).toHaveTextContent("Jordan Rivera");
    expect(within(jordan).getByText("Primary")).toBeInTheDocument();
    expect(within(jordan).getByText("Insured")).toBeInTheDocument();
    expect(within(jordan).getByRole("link", { name: "(512) 555-0142" })).toHaveAttribute(
      "href",
      "tel:+15125550142",
    );
    expect(within(jordan).getByRole("link", { name: "jordan.rivera@example.com" })).toHaveAttribute(
      "href",
      "mailto:jordan.rivera@example.com",
    );
    expect(within(jordan).getByText("Prefers a call")).toBeInTheDocument();
  });

  test("none yet says who to add", async () => {
    seededClaim().contacts = [];
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    expect((await card()).getByText("No contacts yet")).toBeInTheDocument();
  });
});

describe("adding a contact", () => {
  test("from the address book, with the part their kind suggests", async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user);

    // Jordan is on the claim already, so only Casey is offered.
    const found = await dialog.findByRole("list", { name: "Matching contacts" });
    expect(within(found).getAllByRole("listitem")).toHaveLength(1);
    await user.click(dialog.getByRole("button", { name: "Choose Casey Brooks" }));

    expect(dialog.getByRole("combobox", { name: /^Their part/ })).toHaveTextContent(
      "Insurance agent",
    );
    // A claim with a primary contact keeps it, unless told otherwise.
    expect(dialog.getByRole("checkbox", { name: /Primary contact/ })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Add to claim" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await names()).toEqual(["Jordan Rivera", "Casey Brooks"]);
    expect(seededClaim().contacts.map((c) => [c.contact.full_name, c.role, c.is_primary])).toEqual([
      ["Jordan Rivera", "insured", true],
      ["Casey Brooks", "insurance_agent", false],
    ]);
  });

  test("searching says when nobody matches", async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user);

    await user.type(dialog.getByRole("searchbox", { name: /^Search the address book/ }), "zz");

    expect(await dialog.findByText('Nobody in the address book matches "zz".')).toBeInTheDocument();
  });

  test("someone new goes into the address book and onto the claim", async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user);

    await user.click(dialog.getByRole("button", { name: "Add someone new" }));
    await user.click(dialog.getByRole("textbox", { name: /^Name/ }));
    await user.paste("Sam Tenant");
    await user.click(dialog.getByRole("textbox", { name: /^Phone/ }));
    await user.paste("512-555-0100");
    await chooseRole(user, "Tenant");
    await user.click(screen.getByRole("button", { name: "Add to claim" }));

    await waitFor(() => {
      expect(seededClaim().contacts.map((c) => c.contact.full_name)).toContain("Sam Tenant");
    });
    const filed = backend.db.contacts.find((c) => c.contact.full_name === "Sam Tenant")?.contact;
    expect(filed).toMatchObject({ kind: "tenant", phone: "+15125550100" });
    expect(await (await card()).findByRole("link", { name: "(512) 555-0100" })).toBeInTheDocument();
  });

  test("asks for who and their part before asking the API", async () => {
    const user = userEvent.setup();
    const dialog = await openAdd(user);

    await user.click(screen.getByRole("button", { name: "Add to claim" }));

    expect(await dialog.findByText("Choose someone, or add someone new.")).toBeInTheDocument();
    expect(dialog.getByText("Choose their part.")).toBeInTheDocument();
    expect(seededClaim().contacts).toHaveLength(1);
  });

  test("the first contact on a claim is its primary one", async () => {
    seededClaim().contacts = [];
    const user = userEvent.setup();
    const dialog = await openAdd(user);

    expect(dialog.getByRole("checkbox", { name: /Primary contact/ })).toBeChecked();
  });

  test("a refusal is told in words, and the form stays open", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims/{claim_id}/contacts", () =>
        problem(409, "contact_already_linked"),
      ),
    );
    const user = userEvent.setup();
    const dialog = await openAdd(user);

    await user.click(await dialog.findByRole("button", { name: "Choose Casey Brooks" }));
    await user.click(screen.getByRole("button", { name: "Add to claim" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("They're on this claim already.");
  });
});

describe("changing a contact on the claim", () => {
  function caseyOnClaim() {
    seededClaim().contacts.push({
      contact: agentContact(),
      role: "insurance_agent",
      is_primary: false,
    });
  }

  async function menuFor(user: User, name: string) {
    await user.click((await card()).getByRole("button", { name: `Change ${name} on this claim` }));
    return within(await screen.findByRole("menu"));
  }

  test("making someone primary takes it from the last one", async () => {
    caseyOnClaim();
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await user.click(
      (await menuFor(user, "Casey Brooks")).getByRole("menuitem", { name: "Make primary" }),
    );

    await waitFor(async () => {
      expect(await names()).toEqual(["Casey Brooks", "Jordan Rivera"]);
    });
    expect((await card()).getAllByText("Primary")).toHaveLength(1);
    expect(seededClaim().contacts.find((c) => c.is_primary)?.contact.full_name).toBe(
      "Casey Brooks",
    );
  });

  test("removing someone takes them off the claim, not out of the address book", async () => {
    caseyOnClaim();
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await user.click(
      (await menuFor(user, "Casey Brooks")).getByRole("menuitem", { name: "Remove from claim" }),
    );

    await waitFor(async () => {
      expect(await names()).toEqual(["Jordan Rivera"]);
    });
    expect(backend.db.contacts.find((c) => c.contact.full_name === "Casey Brooks")?.deleted).toBe(
      false,
    );
  });
});

describe("who can change the contacts", () => {
  test("someone not allowed to change claims only sees them", async () => {
    await renderApp(CLAIM, { signedInAs: "riley@example.com" });

    const contacts = await card();
    expect(contacts.getByText("Jordan Rivera")).toBeInTheDocument();
    expect(contacts.queryByRole("button")).not.toBeInTheDocument();
  });
});
