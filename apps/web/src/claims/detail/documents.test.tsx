import { ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const DOCUMENTS = "/lone-star/claims/2026-00042/documents";
const WORD = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type User = ReturnType<typeof userEvent.setup>;

const open = () => renderApp(DOCUMENTS, { signedInAs: "morgan@example.com" });
const input = () => screen.findByTestId<HTMLInputElement>("file-input");
const list = async () => within(await screen.findByRole("list", { name: "Documents" }));
const titles = async () =>
  (await list()).getAllByRole("listitem").map((item) => item.querySelector("span")?.textContent);
const file = (name: string, type: string, size = 300) =>
  new File([new Uint8Array(size)], name, { type });
/** The documents the backend has, other than the seeded one. */
const added = () => backend.db.documents.filter((d) => d.document.id !== ids.document);

async function choose(user: User, field: RegExp, option: string) {
  await user.click(await screen.findByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function change(user: User, title: string, item: string) {
  await user.click(await screen.findByRole("button", { name: `Change ${title}` }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("the documents", () => {
  test("are listed with their category, file, size and who attached them", async () => {
    await open();

    const documents = await list();
    expect(documents.getByText("Authorization")).toBeInTheDocument();
    expect(documents.getByText("WA-1042 signed.pdf · PDF, 180 KB")).toBeInTheDocument();
    expect(documents.getByText(/^Attached by Morgan Member, /)).toBeInTheDocument();
    expect(
      documents.getByRole("link", { name: "Signed work authorization (opens in a new tab)" }),
    ).toHaveAttribute("target", "_blank");
    expect(
      documents.getByRole("link", { name: "Download Signed work authorization" }),
    ).toHaveAttribute("download", "WA-1042 signed.pdf");
  });

  test("are filtered by category", async () => {
    const user = userEvent.setup();
    await open();
    await list();

    await choose(user, /^Show/, "Invoice");

    expect(await screen.findByText("No invoice documents")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show every document" }));
    expect(await titles()).toEqual(["Signed work authorization"]);
  });

  test("on a closed claim can be downloaded, not attached or changed", async () => {
    const entry = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (entry) entry.claim.status = "closed";
    await open();

    const documents = await list();
    expect(documents.getByRole("link", { name: /^Download/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Attach documents" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change Signed work authorization" }),
    ).not.toBeInTheDocument();
  });
});

describe("attaching documents", () => {
  test("each goes up under the category chosen, titled from its name", async () => {
    const user = userEvent.setup();
    await open();

    await choose(user, /^File new documents under/, "Invoice");
    await user.upload(await input(), [
      file("Invoice 7.pdf", "application/pdf"),
      file("Scope.docx", WORD),
    ]);

    const attaching = within(await screen.findByRole("list", { name: "Attaching" }));
    await waitFor(() => {
      expect(attaching.getAllByText("Attached")).toHaveLength(2);
    });
    expect(added().map((d) => [d.document.title, d.document.category])).toEqual([
      ["Invoice 7", "invoice"],
      ["Scope", "invoice"],
    ]);
    await waitFor(async () => {
      expect(await titles()).toHaveLength(3);
    });
    // Word can't be shown in the browser: it's only downloaded.
    expect(screen.queryByRole("link", { name: "Scope (opens in a new tab)" })).toBeNull();
  });

  test("a refused one says why, and can be tried again", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims/{claim_id}/document-uploads", () =>
        problem(422, "document_too_large", { limit: 52_428_800 }),
      ),
    );
    const user = userEvent.setup();
    await open();

    await user.upload(await input(), [file("Policy.pdf", "application/pdf")]);

    expect(await screen.findByText("It's over 50 MB.")).toBeInTheDocument();
    server.resetHandlers(); // trying again reaches the backend, which takes it
    await user.click(screen.getByRole("button", { name: "Try Policy.pdf again" }));
    expect(await screen.findByText("Attached")).toBeInTheDocument();
  });
});

describe("changing a document", () => {
  test("it's renamed and recategorized", async () => {
    const user = userEvent.setup();
    await open();

    await change(user, "Signed work authorization", "Rename or recategorize");
    const title = await screen.findByRole("textbox", { name: /^Title/ });
    await user.clear(title);
    await user.type(title, "WA-1042");
    await choose(user, /^Category/, "Policy");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await (await list()).findByText("WA-1042")).toBeInTheDocument();
    expect((await list()).getByText("Policy")).toBeInTheDocument();
    expect(backend.db.documents[0]?.document).toMatchObject({
      title: "WA-1042",
      category: "policy",
    });
  });

  test("deleting asks first, then it's gone", async () => {
    const user = userEvent.setup();
    await open();

    await change(user, "Signed work authorization", "Delete");
    const dialog = within(
      await screen.findByRole("alertdialog", { name: "Delete “Signed work authorization”?" }),
    );
    await user.click(dialog.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("No documents yet")).toBeInTheDocument();
    expect(backend.db.documents).toEqual([]);
  });
});
