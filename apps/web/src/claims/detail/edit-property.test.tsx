import { fixtureId, ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within, type BoundFunctions, type queries } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const CLAIM = "/lone-star/claims/2026-00042";

type User = ReturnType<typeof userEvent.setup>;

async function openEditor(user: User) {
  await renderApp(CLAIM, { signedInAs: "morgan@example.com" });
  await user.click(await screen.findByRole("button", { name: "Edit property" }));
  return within(await screen.findByRole("dialog", { name: "Edit the property" }));
}

async function replace(
  user: User,
  view: BoundFunctions<typeof queries>,
  label: RegExp,
  text: string,
) {
  const field = view.getByRole("textbox", { name: label });
  await user.clear(field);
  if (text) {
    await user.click(field);
    await user.paste(text);
  }
}

const address = async () => {
  const card = within(await screen.findByRole("region", { name: "Property" }));
  const terms = card.getAllByRole("term");
  return card.getAllByRole("definition")[terms.findIndex((t) => t.textContent === "Address")]
    ?.textContent;
};

describe("editing the property", () => {
  test("opens with the property as it is, and the change shows on every claim there", async () => {
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    expect(dialog.getByRole("textbox", { name: /^Street address/ })).toHaveValue(
      "100 Congress Ave",
    );
    expect(dialog.getByText("Every claim at this property shows the change.")).toBeInTheDocument();
    await replace(user, dialog, /^Apartment, suite/, "Unit 4");
    await replace(user, dialog, /^Year built/, "");
    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    await waitFor(async () => {
      expect(await address()).toBe("100 Congress Ave, Unit 4\nAustin, TX 78701");
    });
    // The older claim at the same property shows it too.
    expect(backend.db.claims.map((c) => c.claim.property.address.formatted)).toEqual([
      "100 Congress Ave Unit 4, Austin, TX 78701",
      "100 Congress Ave Unit 4, Austin, TX 78701",
    ]);
    expect(backend.db.claims[1]?.claim.property.year_built).toBeNull();
  });

  test("checks what it can before asking, as the new-claim form does", async () => {
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    await replace(user, dialog, /^Street address/, "");
    await replace(user, dialog, /^Year built/, "1500");
    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(await dialog.findByText("Enter the street address.")).toBeInTheDocument();
    expect(dialog.getByText(/^Enter a year from 1600/)).toBeInTheDocument();
  });

  test("an address another property has is pointed out on the street", async () => {
    server.use(
      mock.patch("/v1/organizations/{organization_id}/properties/{property_id}", () =>
        problem(409, "property_exists", { property_id: fixtureId("property", 2) }),
      ),
    );
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(
      await dialog.findByText("Another property already has this address."),
    ).toBeInTheDocument();
  });

  test("someone not allowed to change claims can't edit it", async () => {
    await renderApp(CLAIM, { signedInAs: "riley@example.com" });
    await screen.findByRole("region", { name: "Property" });
    expect(screen.queryByRole("button", { name: "Edit property" })).not.toBeInTheDocument();
  });

  test("a closed claim's property can't be edited from it", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await screen.findByRole("region", { name: "Property" });
    expect(screen.queryByRole("button", { name: "Edit property" })).not.toBeInTheDocument();
  });
});
