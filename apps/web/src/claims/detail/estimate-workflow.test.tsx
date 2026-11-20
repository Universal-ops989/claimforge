import { ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";
import { estimateMoveLabel, estimateMoveNeeds } from "./estimate-workflow";

const mock = mockApi(API_URL);
const CLAIM = "/lone-star/claims/2026-00042";
const EDITOR = `${CLAIM}/estimates/${ids.estimate}`;

type User = ReturnType<typeof userEvent.setup>;

const open = () => renderApp(EDITOR, { signedInAs: "morgan@example.com" });
const seeded = () => {
  const entry = backend.db.estimates[0];
  if (!entry) throw new Error("no estimate");
  return entry;
};
const moves = () =>
  screen
    .getAllByRole("button")
    .map((b) => b.textContent)
    .filter((name) =>
      ["Submit", "Withdraw", "Approve", "Reject", "Rework", "Reopen", "Delete draft"].includes(
        name,
      ),
    );

async function confirm(user: User, title: string, button: string) {
  const dialog = within(await screen.findByRole("alertdialog", { name: title }));
  await user.click(dialog.getByRole("button", { name: button }));
}

describe("moving an estimate along", () => {
  test("a draft is submitted, and then can be withdrawn, approved or rejected", async () => {
    const user = userEvent.setup();
    await open();

    await screen.findByRole("button", { name: "Submit" });
    expect(moves()).toEqual(["Submit", "Delete draft"]);
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Estimate 1 is submitted.")).toBeInTheDocument();
    await waitFor(() => {
      expect(moves()).toEqual(["Withdraw", "Approve", "Reject"]);
    });
    expect(seeded().estimate.status).toBe("submitted");
  });

  test("approving asks first, naming the total; an approved one can be reopened, asking too", async () => {
    seeded().estimate.status = "submitted";
    const user = userEvent.setup();
    await open();

    await user.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Mitigation, for $507.60.")).toBeInTheDocument();
    await confirm(user, "Approve estimate 1?", "Approve");

    expect(await screen.findByText("Estimate 1 is approved.")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    await confirm(user, "Reopen estimate 1?", "Reopen");
    await waitFor(() => {
      expect(seeded().estimate.status).toBe("draft");
    });
  });

  test("a rejected estimate is reworked back to a draft", async () => {
    seeded().estimate.status = "submitted";
    const user = userEvent.setup();
    await open();

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    await confirm(user, "Reject estimate 1?", "Reject");
    await user.click(await screen.findByRole("button", { name: "Rework" }));

    expect(await screen.findByText("Estimate 1 is draft.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Add a line" })).toBeInTheDocument();
  });

  test("an empty draft can't be submitted, and says why", async () => {
    seeded().lines = [];
    seeded().roomIds = [];
    await open();

    expect(await screen.findByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByText("Add a line before submitting.")).toBeInTheDocument();
  });

  test("a refusal is told in words", async () => {
    server.use(
      mock.post(
        "/v1/organizations/{organization_id}/claims/{claim_id}/estimates/{estimate_id}/status",
        () =>
          problem(422, "estimate_transition", { detail: "A draft estimate can't become approved" }),
      ),
    );
    const user = userEvent.setup();
    await open();

    await user.click(await screen.findByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A draft estimate can't become approved",
    );
  });
});

describe("who can move it", () => {
  test("without the right to approve, a submitted estimate can only be withdrawn", async () => {
    const morgan = backend.db.accounts.find((a) => a.email === "morgan@example.com");
    const membership = morgan?.user.memberships[0];
    if (membership) {
      membership.permissions = membership.permissions.filter((p) => p !== "estimates:approve");
    }
    seeded().estimate.status = "submitted";
    await open();

    await screen.findByRole("button", { name: "Withdraw" });
    expect(moves()).toEqual(["Withdraw"]);
  });
});

describe("deleting a draft", () => {
  test("asks first, then goes back to the list", async () => {
    const user = userEvent.setup();
    const { router } = await open();

    await user.click(await screen.findByRole("button", { name: "Delete draft" }));
    await confirm(user, "Delete estimate 1?", "Delete");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`${CLAIM}/estimates`);
    });
    expect(await screen.findByText("No estimates yet")).toBeInTheDocument();
  });
});

test("moves read as people say them, and take the right permission", () => {
  expect(estimateMoveLabel("submitted", "draft")).toBe("Withdraw");
  expect(estimateMoveLabel("rejected", "draft")).toBe("Rework");
  expect(estimateMoveLabel("approved", "draft")).toBe("Reopen");
  expect(estimateMoveNeeds("submitted", "draft")).toBe("estimates:write");
  expect(estimateMoveNeeds("approved", "draft")).toBe("estimates:approve");
  expect(estimateMoveNeeds("submitted", "rejected")).toBe("estimates:approve");
});
