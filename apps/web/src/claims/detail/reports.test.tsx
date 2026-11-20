import { ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const REPORTS = "/lone-star/claims/2026-00042/reports";

const open = (as: "morgan@example.com" | "riley@example.com" = "morgan@example.com") =>
  renderApp(REPORTS, { signedInAs: as });
const rows = async () =>
  within(await screen.findByRole("list", { name: "Reports" })).getAllByRole("group");
const seeded = () => {
  const entry = backend.db.reports[0];
  if (!entry) throw new Error("no report");
  return entry;
};

describe("the reports", () => {
  test("are listed with who asked, how big they are, and a download", async () => {
    await open();

    const [report] = await rows();
    const row = within(report ?? document.body);

    expect(row.getByText("Photo report")).toBeInTheDocument();
    expect(row.getByText("Ready")).toBeInTheDocument();
    expect(row.getByText(/^Asked for by Morgan Member, .* · PDF, \d+ KB$/)).toBeInTheDocument();
    expect(row.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      expect.stringMatching(/__mock-storage\/files\/report-.*\?download=1$/),
    );
  });

  test("a new one is made a moment later, and that it's ready is announced", async () => {
    const user = userEvent.setup();
    await open();
    await rows();

    await user.click(screen.getByRole("button", { name: "Make drying report" }));

    expect(await screen.findByText("Making the drying report…")).toHaveAttribute("role", "status");
    const [newest] = await rows();
    expect(within(newest ?? document.body).getByText("Being made")).toBeInTheDocument();
    const queued = backend.db.reports.find((r) => r.report.status === "queued");
    if (queued) queued.readyAt = 0;

    expect(
      await screen.findByText("Drying report is ready to download.", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(await rows()).toHaveLength(2);
  });

  test("one that failed says why", async () => {
    Object.assign(seeded().report, {
      status: "failed",
      error: "Storage unavailable",
      download_url: null,
    });
    await open();

    const row = within((await rows())[0] ?? document.body);
    expect(row.getByText("Failed")).toBeInTheDocument();
    expect(row.getByText(/^Storage unavailable Make it again/)).toBeInTheDocument();
    expect(row.queryByRole("link", { name: "Download" })).not.toBeInTheDocument();
  });

  test("someone not allowed to make reports can still download them", async () => {
    await open("riley@example.com");

    const row = within((await rows())[0] ?? document.body);
    expect(row.getByRole("link", { name: "Download" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Make/ })).not.toBeInTheDocument();
    expect(row.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(row.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
  });

  test("a refusal is told in words", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims/{claim_id}/reports", () =>
        problem(403, "permission_denied", { required_permission: "reports:generate" }),
      ),
    );
    const user = userEvent.setup();
    await open();
    await rows();

    await user.click(screen.getByRole("button", { name: "Make photo report" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You aren't allowed to make or change reports here.",
    );
  });

  test("deleting asks first, then the report is gone", async () => {
    const user = userEvent.setup();
    await open();
    await rows();

    await user.click(screen.getByRole("button", { name: "Delete the photo report" }));
    const dialog = within(
      await screen.findByRole("alertdialog", { name: "Delete the photo report?" }),
    );
    await user.click(dialog.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("No reports yet")).toBeInTheDocument();
    expect(backend.db.reports).toEqual([]);
  });
});

describe("sharing a report", () => {
  test("a link is made, shown once to copy, listed with its opens, and revoked", async () => {
    const user = userEvent.setup();
    await open();
    await rows();

    await user.click(screen.getByRole("button", { name: "Share" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Share the photo report" }));
    expect(await dialog.findByText("No links yet.")).toBeInTheDocument();
    await user.type(dialog.getByRole("textbox", { name: /^Who it's for/ }), "For Lone Star Mutual");
    await user.click(dialog.getByRole("button", { name: "Make link" }));

    const link = await dialog.findByRole("textbox", { name: /^The new link/ });
    expect((link as HTMLInputElement).value).toMatch(/^https:\/\/api\.test\/v1\/shared-reports\//);
    await user.click(dialog.getByRole("button", { name: "Copy link" }));
    expect(await dialog.findByText("Copied.")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe((link as HTMLInputElement).value);

    const links = within(await dialog.findByRole("list", { name: "Links" }));
    expect(links.getByText("For Lone Star Mutual")).toBeInTheDocument();
    expect(links.getByText(/^Works until .* · Not opened yet$/)).toBeInTheDocument();

    await user.click(links.getByRole("button", { name: "Revoke the link For Lone Star Mutual" }));
    await waitFor(() => {
      expect(links.getByText(/^Revoked · Not opened yet$/)).toBeInTheDocument();
    });
    expect(backend.db.shares[0]?.share.revoked_at).not.toBeNull();
  });

  test("opens are counted and shown", async () => {
    const user = userEvent.setup();
    backend.db.shares.push({
      claimId: ids.claim,
      token: "t",
      share: {
        id: "0198a2c4-7b1e-7cc0-8000-001c00000001",
        report_id: ids.report,
        label: null,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        revoked_at: null,
        open_count: 3,
        last_opened_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        created_by: null,
        created_at: new Date().toISOString(),
      },
    });
    await open();
    await rows();

    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(
      await screen.findByText(/^Works until .* · Opened 3 times, last 2 hours ago$/),
    ).toBeInTheDocument();
    expect(screen.getByText("A link without a label")).toBeInTheDocument();
  });
});
