import { claim, fixtureId, ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { API_URL, backend, renderApp, server } from "../test/render";

const mock = mockApi(API_URL);
/** A dashboard card: each is a region named by its title. */
const card = async (title: string) => within(await screen.findByRole("region", { name: title }));

afterEach(() => {
  vi.useRealTimers();
});

describe("claims in progress", () => {
  test("counts each active status, each a link to the list filtered to it", async () => {
    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });
    const counts = await card("Claims in progress");

    const rows = await counts.findAllByRole("listitem");
    await vi.waitFor(() => {
      expect(rows.map((row) => row.textContent)).toEqual([
        "New1",
        "Inspected1",
        "In progress0",
        "On hold0",
      ]);
    });
    expect(counts.getByRole("link", { name: "On hold" })).toHaveAttribute(
      "href",
      "/lone-star/claims?status=on_hold",
    );
  });

  test("past the limit, says so", async () => {
    for (let n = 100; n < 200; n += 1) {
      backend.db.claims.push({
        organizationId: ids.organization,
        claim: claim({ id: fixtureId("claim", n), number: `2026-${String(n).padStart(5, "0")}` }),
      });
    }

    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });
    const counts = await card("Claims in progress");

    expect(await counts.findByText("100+")).toBeInTheDocument();
  });
});

describe("my open tasks", () => {
  test("lists them with their claim and due date, overdue ones marked", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T09:00:00")); // the seeded task was due on the 18th

    await renderApp("/lone-star", { signedInAs: "riley@example.com" });
    const tasks = await card("My open tasks");

    expect(await tasks.findByText("1 open")).toBeInTheDocument();
    expect(tasks.getByText("Set dryers in the kitchen")).toBeInTheDocument();
    expect(tasks.getByRole("link", { name: "2026-00042" })).toHaveAttribute(
      "href",
      "/lone-star/claims/2026-00042",
    );
    expect(tasks.getByText("Due Nov 18")).toBeInTheDocument();
    expect(tasks.getByText("Overdue")).toBeInTheDocument();
  });

  test("a task due later isn't overdue", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T09:00:00"));

    await renderApp("/lone-star", { signedInAs: "riley@example.com" });
    const tasks = await card("My open tasks");

    expect(await tasks.findByText("1 open")).toBeInTheDocument();
    expect(tasks.queryByText("Overdue")).not.toBeInTheDocument();
  });

  test("says when there's nothing", async () => {
    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });

    expect(
      await (await card("My open tasks")).findByText("Nothing assigned to you"),
    ).toBeInTheDocument();
  });

  test("fails on its own: the other cards still show", async () => {
    server.use(
      mock.get("/v1/organizations/{organization_id}/tasks/assigned-to-me", () =>
        problem(500, "internal_error"),
      ),
    );

    await renderApp("/lone-star", { signedInAs: "riley@example.com" });

    expect(
      await (await card("My open tasks")).findByText("Something went wrong"),
    ).toBeInTheDocument();
    expect(await (await card("Claims in progress")).findByText("New")).toBeInTheDocument();
  });
});

describe("mentions", () => {
  test("shows notes mentioning me, with who wrote them and on which claim", async () => {
    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });
    const mentions = await card("Mentions");

    expect(
      await mentions.findByText("Dryers set, @Morgan Member to check tomorrow"),
    ).toBeInTheDocument();
    expect(mentions.getByText("Riley Tech on")).toBeInTheDocument();
    expect(mentions.getByRole("link", { name: "2026-00042" })).toBeInTheDocument();
  });

  test("says when there are none", async () => {
    await renderApp("/lone-star", { signedInAs: "riley@example.com" });

    expect(
      await (await card("Mentions")).findByText("No one has mentioned you"),
    ).toBeInTheDocument();
  });
});

describe("recently updated claims", () => {
  test("newest change first, with status, place and how long ago", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
    // The older claim changed yesterday: newest change, not newest claim, comes first.
    const older = backend.db.claims.find((c) => c.claim.number === "2026-00041");
    if (older) older.claim.updated_at = "2026-11-16T09:00:00Z";

    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });
    const recent = await card("Recently updated claims");

    const rows = await recent.findAllByRole("listitem");
    expect(rows.map((row) => within(row).getAllByRole("link")[0]?.textContent)).toEqual([
      "2026-00041", // changed yesterday, opened Nov 2
      "2026-00042", // changed Nov 10, opened Nov 10
    ]);
    const [newest, first] = rows;
    if (!newest || !first) throw new Error("expected two rows");
    expect(within(newest).getByText("yesterday")).toBeInTheDocument();
    expect(within(first).getByText("New")).toBeInTheDocument();
    expect(
      within(first).getByText("Water · 100 Congress Ave, Austin, TX 78701"),
    ).toBeInTheDocument();
    const when = within(first).getByText("7 days ago");
    expect(when).toHaveAttribute("datetime", "2026-11-10T15:00:00Z");
    expect(when.getAttribute("title")).toMatch(/2026/);
    expect(within(first).getByRole("link", { name: "2026-00042" })).toHaveAttribute(
      "href",
      "/lone-star/claims/2026-00042",
    );
  });

  test("leads to all claims, sorted the same way", async () => {
    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });

    expect(
      (await card("Recently updated claims")).getByRole("link", { name: "All claims" }),
    ).toHaveAttribute("href", "/lone-star/claims?sort=-updated_at");
  });

  test("says when there are no claims yet", async () => {
    backend.db.claims = [];

    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });

    expect(
      await (await card("Recently updated claims")).findByText("No claims yet"),
    ).toBeInTheDocument();
  });
});
