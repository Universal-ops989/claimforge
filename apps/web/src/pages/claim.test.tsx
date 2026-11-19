import { ids, people, timelineEntry } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../test/render";

const mock = mockApi(API_URL);
const CLAIM = "/lone-star/claims/2026-00042";

const open = (path: string) => renderApp(path, { signedInAs: "morgan@example.com" });
const tab = (name: string) => screen.findByRole("tab", { name });
/** Wait until `name` is the chosen tab (a tab's code loads on first visit). */
const chosen = (name: string) =>
  waitFor(() => {
    expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
  });

/** Put `count` timeline entries on the claim, the newest numbered highest. */
function addTimeline(count: number) {
  for (let n = 1; n <= count; n += 1) {
    backend.db.timeline.push({
      claimId: ids.claim,
      entry: timelineEntry({
        id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        at: new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString(),
        summary: `Change ${String(n)}`,
      }),
    });
  }
}

describe("the claim's header", () => {
  test("says what the claim is: status, loss, property and adjuster", async () => {
    const seeded = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (!seeded) throw new Error("no seeded claim");
    seeded.claim.assignments = [
      {
        user: people.riley,
        role: "adjuster",
        assigned_at: seeded.claim.created_at,
        assigned_by_id: null,
      },
    ];
    await open(CLAIM);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Claim 2026-00042");
    expect(await screen.findByText("New")).toBeInTheDocument();
    expect(
      screen.getByText("Water loss · 100 Congress Ave, Austin, TX 78701 · Adjuster: Riley Tech"),
    ).toBeInTheDocument();
  });

  test("says when nobody is adjusting it, and leads back to the claims", async () => {
    await open(CLAIM);

    expect(await screen.findByText(/· No adjuster yet$/)).toBeInTheDocument();
    const trail = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(trail).getByRole("link", { name: "Claims" })).toHaveAttribute(
      "href",
      "/lone-star/claims",
    );
  });
});

describe("tabs in the address", () => {
  test("the claim's own address is its overview", async () => {
    await open(CLAIM);

    expect(await tab("Overview")).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Supply line burst under the kitchen sink")).toBeInTheDocument();
  });

  test("choosing a tab moves the address, and going back returns", async () => {
    const user = userEvent.setup();
    const { router } = await open(CLAIM);

    await user.click(await tab("Timeline"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`${CLAIM}/timeline`);
    });
    await chosen("Timeline");

    await router.navigate(-1);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(CLAIM);
    });
    await chosen("Overview");
  });

  test("a tab's address opens on that tab", async () => {
    await open(`${CLAIM}/timeline`);

    expect(await tab("Timeline")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "false");
  });
});

describe("a claim that isn't there", () => {
  test("says so inside the app, and leads to the claims", async () => {
    await open("/lone-star/claims/2026-99999");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Claim not found" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lone Star Restoration has no claim 2026-99999/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to claims" })).toHaveAttribute(
      "href",
      "/lone-star/claims",
    );
    // Still in the app's frame, with its navigation.
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  test("any other failure is told as itself, with a retry", async () => {
    server.use(
      mock.get("/v1/organizations/{organization_id}/claims/by-number/{number}", () =>
        problem(500, "internal_error"),
      ),
    );
    await open(CLAIM);

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Claim not found")).not.toBeInTheDocument();
  });
});

describe("the timeline", () => {
  test("lists what happened, newest first, and who did it", async () => {
    addTimeline(2);
    await open(`${CLAIM}/timeline`);

    const list = await screen.findByRole("list", { name: "Timeline" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByText(/^Change/).textContent)).toEqual([
      "Change 2",
      "Change 1",
    ]);
    expect(items[0]).toHaveTextContent("Morgan Member");
  });

  test("what ClaimForge did itself is told as ClaimForge's", async () => {
    backend.db.timeline.push({
      claimId: ids.claim,
      entry: timelineEntry({ actor: null, summary: "Closed after 90 days on hold" }),
    });
    await open(`${CLAIM}/timeline`);

    const entry = (await screen.findByText("Closed after 90 days on hold")).closest("li");
    expect(entry).toHaveTextContent("ClaimForge");
  });

  test("shows earlier entries on request", async () => {
    const user = userEvent.setup();
    addTimeline(30);
    await open(`${CLAIM}/timeline`);

    const list = await screen.findByRole("list", { name: "Timeline" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(25);

    await user.click(screen.getByRole("button", { name: "Show earlier" }));

    await waitFor(() => {
      expect(within(list).getAllByRole("listitem")).toHaveLength(30);
    });
    expect(screen.queryByRole("button", { name: "Show earlier" })).not.toBeInTheDocument();
  });

  test("an empty one says what will show up there", async () => {
    await open(`${CLAIM}/timeline`);

    expect(await screen.findByText("Nothing has happened yet")).toBeInTheDocument();
  });
});

describe("the overview", () => {
  /** A card's facts, term → value, as they read. */
  async function facts(card: string) {
    const region = await screen.findByRole("region", { name: card });
    const terms = within(region).getAllByRole("term");
    const values = within(region).getAllByRole("definition");
    return Object.fromEntries(terms.map((term, i) => [term.textContent, values[i]?.textContent]));
  }

  test("shows the loss, the property and the insurance", async () => {
    const seeded = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (!seeded) throw new Error("no seeded claim");
    seeded.claim = {
      ...seeded.claim,
      carrier_name: "Lone Star Mutual",
      policy_number: "HO-123",
      property: { ...seeded.claim.property, access_notes: "Key under the mat" },
    };
    await open(CLAIM);

    expect(await facts("What happened")).toEqual({
      Cause: "Water",
      "Date of loss": "Nov 10, 2026",
      Description: "Supply line burst under the kitchen sink",
    });
    expect(await facts("Property")).toEqual({
      Address: "100 Congress Ave\nAustin, TX 78701",
      Type: "Residential",
      "Year built": "1998",
      "Access notes": "Key under the mat",
    });
    expect(await facts("Insurance")).toEqual({
      Carrier: "Lone Star Mutual",
      "Policy number": "HO-123",
      "Carrier's claim number": "Not given",
    });
    expect(Object.keys(await facts("Record"))).toEqual(["Opened", "Last changed"]);
  });

  test("says what isn't known yet, rather than leaving gaps", async () => {
    const seeded = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (!seeded) throw new Error("no seeded claim");
    seeded.claim = {
      ...seeded.claim,
      loss_date: null,
      description: null,
      property: { ...seeded.claim.property, year_built: null },
    };
    await open(CLAIM);

    const loss = await facts("What happened");
    expect(loss["Date of loss"]).toBe("Not given");
    expect(loss.Description).toBe("Not given");
    expect((await facts("Property"))["Year built"]).toBe("Not given");
  });
});
