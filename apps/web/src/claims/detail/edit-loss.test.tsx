import { ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const CLAIM = "/lone-star/claims/2026-00042";
const PATCH = "/v1/organizations/{organization_id}/claims/{claim_id}";

function seededClaim() {
  const seeded = backend.db.claims.find((c) => c.claim.id === ids.claim);
  if (!seeded) throw new Error("no seeded claim");
  return seeded;
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await renderApp(CLAIM, { signedInAs: "morgan@example.com" });
  await user.click(await screen.findByRole("button", { name: "Edit what happened" }));
  return within(await screen.findByRole("dialog", { name: "Edit loss and insurance" }));
}

/** A card's value for `term`, as it reads. */
async function factIn(card: string, term: string) {
  const region = await screen.findByRole("region", { name: card });
  const terms = within(region).getAllByRole("term");
  const index = terms.findIndex((t) => t.textContent === term);
  return within(region).getAllByRole("definition")[index]?.textContent;
}

describe("editing the loss and insurance", () => {
  test("opens with the claim as it is, and saves what changed", async () => {
    seededClaim().claim.policy_number = "HO-123";
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    const description = dialog.getByRole("textbox", { name: /^What happened/ });
    expect(description).toHaveValue("Supply line burst under the kitchen sink");
    const policy = dialog.getByRole("textbox", { name: /^Policy number/ });
    expect(policy).toHaveValue("HO-123");

    await user.clear(description);
    await user.type(description, "Dishwasher hose split");
    await user.clear(policy);
    await user.type(
      dialog.getByRole("textbox", { name: /^Insurance carrier/ }),
      "Lone Star Mutual",
    );
    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await factIn("What happened", "Description")).toBe("Dishwasher hose split");
    expect(await factIn("Insurance", "Carrier")).toBe("Lone Star Mutual");
    // A cleared field is cleared on the claim, not left as it was.
    expect(await factIn("Insurance", "Policy number")).toBe("Not given");
    expect(seededClaim().claim.policy_number).toBeNull();
  });

  test("both cards' Edit open the same form", async () => {
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await user.click(await screen.findByRole("button", { name: "Edit insurance" }));

    expect(
      await screen.findByRole("dialog", { name: "Edit loss and insurance" }),
    ).toBeInTheDocument();
  });

  test("Cancel leaves the claim alone, and the next opening starts afresh", async () => {
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    await user.type(dialog.getByRole("textbox", { name: /^Insurance carrier/ }), "Typo Mutual");
    await user.click(dialog.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Edit what happened" }));

    const reopened = within(await screen.findByRole("dialog"));
    expect(reopened.getByRole("textbox", { name: /^Insurance carrier/ })).toHaveValue("");
    expect(seededClaim().claim.carrier_name).toBeNull();
  });

  test("checks what it can before asking, as the new-claim form does", async () => {
    let asked = false;
    server.use(
      mock.patch(PATCH, () => {
        asked = true;
        return problem(500, "internal_error");
      }),
    );
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    await user.type(dialog.getByRole("textbox", { name: /^Policy number/ }), "x".repeat(65));
    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(await dialog.findByText("Keep this to 64 characters or fewer.")).toBeInTheDocument();
    expect(asked).toBe(false);
  });

  test("the API's refusals land on their fields, and the form stays open", async () => {
    server.use(mock.patch(PATCH, () => problem(422, "loss_date_in_future")));
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(await dialog.findByText("The date of loss can't be in the future.")).toBeInTheDocument();
    expect(dialog.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("a claim closed meanwhile says why it can't be saved", async () => {
    server.use(mock.patch(PATCH, () => problem(409, "claim_locked")));
    const user = userEvent.setup();
    const dialog = await openEditor(user);

    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "This claim was closed or cancelled",
    );
  });
});

describe("who can edit", () => {
  test("someone not allowed to change claims sees no Edit", async () => {
    await renderApp(CLAIM, { signedInAs: "riley@example.com" });

    await screen.findByRole("region", { name: "What happened" });
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });

  test.each(["closed", "cancelled"] as const)(
    "a %s claim is read-only, and says so",
    async (status) => {
      seededClaim().claim.status = status;
      await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

      expect(
        await screen.findByText(`This claim is ${status}, so its details can't be changed.`),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
    },
  );
});
