import type { Schema } from "@claimforge/api-client";
import { fixtureId, ids, people, rolePermissions } from "@claimforge/api-client/fixtures";
import { MOCK_PASSWORD, mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const CLAIM = "/lone-star/claims/2026-00042";
const ASSIGNMENTS = "/v1/organizations/{organization_id}/claims/{claim_id}/assignments";
const SINCE = "2026-11-12T15:00:00Z";

type User = ReturnType<typeof userEvent.setup>;

function seededClaim() {
  const seeded = backend.db.claims.find((c) => c.claim.id === ids.claim);
  if (!seeded) throw new Error("no seeded claim");
  return seeded.claim;
}

/** Put people on the claim before it's opened. */
function onClaim(
  ...team: [Schema<"ClaimActor">, "adjuster" | "field_technician" | "contractor"][]
) {
  seededClaim().assignments = team.map(([user, role]) => ({
    user,
    role,
    assigned_at: SINCE,
    assigned_by_id: null,
  }));
}

/** A third member, an adjuster. */
const avery = { id: fixtureId("person", 3), full_name: "Avery Adjuster" };
function addAvery() {
  backend.db.accounts.push({
    email: "avery@example.com",
    password: MOCK_PASSWORD,
    user: {
      id: avery.id,
      email: "avery@example.com",
      full_name: avery.full_name,
      memberships: [
        {
          organization: { id: ids.organization, name: "Lone Star Restoration", slug: "lone-star" },
          role: "adjuster",
          permissions: rolePermissions.adjuster,
        },
      ],
    },
  });
}

const team = async () => within(await screen.findByRole("region", { name: "Team" }));

async function choose(user: User, field: RegExp, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function openAssign(user: User) {
  await renderApp(CLAIM, { signedInAs: "morgan@example.com" });
  await user.click((await team()).getByRole("button", { name: "Assign someone" }));
  const dialog = await screen.findByRole("dialog", { name: "Assign someone" });
  await within(dialog).findByRole("combobox", { name: /^Who/ });
  return within(dialog);
}

describe("the team", () => {
  test("shows who is on the claim, as what, and since when", async () => {
    onClaim([people.morgan, "adjuster"], [people.riley, "field_technician"]);
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    const items = (await team()).getAllByRole("listitem");

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Morgan MemberAdjuster · since Nov 12, 2026"),
      expect.stringContaining("Riley TechField technician · since Nov 12, 2026"),
    ]);
  });

  test("an empty team says what to do", async () => {
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    expect((await team()).getByText("Nobody yet")).toBeInTheDocument();
  });
});

describe("assigning someone", () => {
  test("offers only the roles that member can take, and puts them on the claim", async () => {
    const user = userEvent.setup();
    const dialog = await openAssign(user);

    await choose(user, /^Who/, "Riley Tech");
    await user.click(dialog.getByRole("combobox", { name: /^As/ }));
    const offered = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(offered).toEqual(["Field technician", "Contractor"]);
    await user.click(screen.getByRole("option", { name: "Field technician" }));
    await user.click(dialog.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await (await team()).findByText("Riley Tech")).toBeInTheDocument();
    expect(seededClaim().assignments.map((a) => [a.user.id, a.role])).toEqual([
      [people.riley.id, "field_technician"],
    ]);
  });

  test("a new adjuster replaces the one there, and says so first", async () => {
    addAvery();
    onClaim([people.morgan, "adjuster"]);
    const user = userEvent.setup();
    const dialog = await openAssign(user);

    // Morgan is on the claim already, so isn't offered.
    await user.click(dialog.getByRole("combobox", { name: /^Who/ }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
      "Avery Adjuster",
      "Riley Tech",
    ]);
    await user.click(screen.getByRole("option", { name: "Avery Adjuster" }));
    await choose(user, /^As/, "Adjuster");

    expect(
      dialog.getByText("Replaces Morgan Member: a claim has one adjuster."),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(seededClaim().assignments.map((a) => a.user.full_name)).toEqual(["Avery Adjuster"]);
    });
    await waitFor(async () => {
      expect((await team()).queryByText("Morgan Member")).not.toBeInTheDocument();
    });
  });

  test("asks for who and as what before asking the API", async () => {
    const user = userEvent.setup();
    const dialog = await openAssign(user);

    await user.click(dialog.getByRole("button", { name: "Assign" }));
    expect(await dialog.findByText("Choose someone.")).toBeInTheDocument();

    await choose(user, /^Who/, "Riley Tech");
    await user.click(dialog.getByRole("button", { name: "Assign" }));
    expect(await dialog.findByText("Choose a role.")).toBeInTheDocument();
    expect(seededClaim().assignments).toEqual([]);
  });

  test("the API's refusals are told in words", async () => {
    server.use(mock.post(ASSIGNMENTS, () => problem(409, "already_assigned")));
    const user = userEvent.setup();
    const dialog = await openAssign(user);

    await choose(user, /^Who/, "Riley Tech");
    await choose(user, /^As/, "Contractor");
    await user.click(dialog.getByRole("button", { name: "Assign" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Riley Tech is already on this claim. Remove them first to give them another role.",
    );
  });

  test("when everyone is on the claim already, says so", async () => {
    onClaim([people.morgan, "adjuster"], [people.riley, "contractor"]);
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await user.click((await team()).getByRole("button", { name: "Assign someone" }));

    expect(
      await screen.findByText("Everyone who can work on claims is already on this one."),
    ).toBeInTheDocument();
  });
});

describe("removing someone", () => {
  test("takes them off the claim", async () => {
    onClaim([people.morgan, "adjuster"], [people.riley, "contractor"]);
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await user.click(
      (await team()).getByRole("button", { name: "Remove Riley Tech from the claim" }),
    );

    await waitFor(async () => {
      expect((await team()).queryByText("Riley Tech")).not.toBeInTheDocument();
    });
    expect(seededClaim().assignments.map((a) => a.user.id)).toEqual([people.morgan.id]);
  });

  test("a refusal puts them back and says why", async () => {
    onClaim([people.riley, "contractor"]);
    server.use(mock.delete(`${ASSIGNMENTS}/{user_id}`, () => problem(409, "claim_locked")));
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await user.click(
      (await team()).getByRole("button", { name: "Remove Riley Tech from the claim" }),
    );

    expect(await (await team()).findByRole("alert")).toHaveTextContent(
      "Riley Tech is still on the claim.",
    );
    expect((await team()).getByText("Riley Tech")).toBeInTheDocument();
  });
});

describe("who can change the team", () => {
  test("someone not allowed to change claims only sees it", async () => {
    onClaim([people.morgan, "adjuster"]);
    await renderApp(CLAIM, { signedInAs: "riley@example.com" });

    const card = await team();
    expect(card.getByText("Morgan Member")).toBeInTheDocument();
    expect(card.queryByRole("button")).not.toBeInTheDocument();
  });

  test("nobody changes the team of a closed claim", async () => {
    onClaim([people.morgan, "adjuster"]);
    seededClaim().status = "closed";
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    expect((await team()).queryByRole("button")).not.toBeInTheDocument();
  });
});
