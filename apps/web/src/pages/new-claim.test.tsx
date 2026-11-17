import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../test/render";

const mock = mockApi(API_URL);

const open = (path = "/lone-star/claims/new") =>
  renderApp(path, { signedInAs: "morgan@example.com" });
/** Wait until the form shows the step called `name`. */
const onStep = (name: string) =>
  waitFor(() => {
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(name);
  });

async function fillProperty(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole("textbox", { name: /^Street address/ }), "5 Elm St");
  await user.type(screen.getByRole("textbox", { name: /^City/ }), "Round Rock");
  await user.type(screen.getByRole("textbox", { name: /^State or region/ }), "TX");
  await user.click(screen.getByRole("button", { name: "Next" }));
}

async function chooseCause(user: ReturnType<typeof userEvent.setup>, cause: string) {
  await user.click(screen.getByRole("combobox", { name: /^Cause of loss/ }));
  await user.click(await screen.findByRole("option", { name: cause }));
}

describe("the property step", () => {
  test("comes first, and Next asks for what's missing", async () => {
    const { router } = await open();
    const user = userEvent.setup();

    await onStep("Property");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Enter the street address.")).toBeInTheDocument();
    expect(screen.getByText("Enter the city.")).toBeInTheDocument();
    expect(router.state.location.search).toBe("");
  });

  test("a year built before 1600 or after this year is refused", async () => {
    await open();
    const user = userEvent.setup();

    await user.type(await screen.findByRole("textbox", { name: /^Year built/ }), "1500");
    await fillProperty(user);

    expect(
      await screen.findByText(`Enter a year from 1600 to ${String(new Date().getFullYear())}.`),
    ).toBeInTheDocument();
  });

  test("an address longer than the API takes is pointed out", async () => {
    await open();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("textbox", { name: /^Street address/ }));
    await user.paste("x".repeat(201));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Keep this to 200 characters or fewer.")).toBeInTheDocument();
  });
});

describe("moving between steps", () => {
  test("Next goes on, putting the step in the address; Back keeps what was typed", async () => {
    const { router } = await open();
    const user = userEvent.setup();

    await fillProperty(user);
    await onStep("Loss");
    expect(router.state.location.search).toBe("?step=loss");
    await user.click(screen.getByRole("button", { name: "Back" }));

    await onStep("Property");
    expect(screen.getByRole("textbox", { name: /^Street address/ })).toHaveValue("5 Elm St");
  });

  test("the browser's Back steps back too", async () => {
    const { router } = await open();
    const user = userEvent.setup();
    await fillProperty(user);
    await onStep("Loss");

    await router.navigate(-1);

    await onStep("Property");
  });

  test("the loss step asks for the cause, then review shows what was entered", async () => {
    await open();
    const user = userEvent.setup();
    await fillProperty(user);

    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Choose what caused the damage.")).toBeInTheDocument();
    await chooseCause(user, "Water");
    await user.type(screen.getByRole("textbox", { name: /^Policy number/ }), "HO-123");
    await user.click(screen.getByRole("button", { name: "Next" }));

    await onStep("Review");
    const summary = within(screen.getByLabelText("Claim summary"));
    expect(summary.getByText(/5 Elm St/)).toBeInTheDocument();
    expect(summary.getByText(/Round Rock, TX/)).toBeInTheDocument();
    expect(summary.getByText("Water")).toBeInTheDocument();
    expect(summary.getByText("HO-123")).toBeInTheDocument();
  });

  test("a later step can't be opened by address before the earlier ones are done", async () => {
    const { router } = await open("/lone-star/claims/new?step=review");

    await onStep("Property");
    expect(router.state.location.search).toBe("?step=property");
  });

  test("the stepper goes back to an earlier step, but not ahead", async () => {
    await open();
    const user = userEvent.setup();
    await fillProperty(user);
    await onStep("Loss");

    await user.click(screen.getByRole("button", { name: /Property/ }));

    await onStep("Property");
    expect(screen.queryByRole("button", { name: /Review/ })).not.toBeInTheDocument();
  });

  test("Cancel goes back to the claims list", async () => {
    const { router } = await open();

    await userEvent.setup().click(await screen.findByRole("link", { name: "Cancel" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/lone-star/claims");
    });
  });
});

describe("creating the claim", () => {
  /** Fill both steps and arrive at Review. */
  async function toReview(user: ReturnType<typeof userEvent.setup>) {
    await fillProperty(user);
    await onStep("Loss");
    await chooseCause(user, "Mold");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await onStep("Review");
  }

  test("creates it, and opens the new claim", async () => {
    const { router } = await open();
    const user = userEvent.setup();
    await toReview(user);

    await user.click(screen.getByRole("button", { name: "Create claim" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/lone-star\/claims\/\d{4}-\d{5}$/);
    });
    const created = backend.db.claims.at(-1)?.claim;
    expect(router.state.location.pathname).toBe(`/lone-star/claims/${created?.number ?? ""}`);
    expect(created).toMatchObject({
      loss_type: "mold",
      property: { address: { line1: "5 Elm St", city: "Round Rock", region: "TX" } },
    });
  });

  test("a field the API refuses sends the user back to it", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims", () =>
        problem(422, "validation_failed", {
          errors: [
            {
              loc: ["body", "property", "address", "region"],
              message: "Use the two-letter state code.",
              type: "value_error",
            },
          ],
        }),
      ),
    );
    await open();
    const user = userEvent.setup();
    await toReview(user);

    await user.click(screen.getByRole("button", { name: "Create claim" }));

    await onStep("Property");
    expect(await screen.findByText("Use the two-letter state code.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Street address/ })).toHaveValue("5 Elm St");
  });

  test("a date of loss the API calls future goes back to the loss step", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims", () =>
        problem(422, "loss_date_in_future"),
      ),
    );
    await open();
    const user = userEvent.setup();
    await toReview(user);

    await user.click(screen.getByRole("button", { name: "Create claim" }));

    await onStep("Loss");
    expect(await screen.findByText("The date of loss can't be in the future.")).toBeInTheDocument();
  });

  test("any other refusal is said on the review step, and Try again can still create", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims", () =>
        problem(403, "permission_denied"),
      ),
    );
    const { router } = await open();
    const user = userEvent.setup();
    await toReview(user);

    await user.click(screen.getByRole("button", { name: "Create claim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have access");
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/lone-star\/claims\/\d{4}-\d{5}$/);
    });
  });
});
