import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../button/button";
import { ConfirmDialog } from "./confirm-dialog";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderDeleteDialog(onConfirm: () => void | Promise<void>) {
  render(
    <ConfirmDialog
      trigger={<Button variant="danger">Delete claim</Button>}
      title="Delete claim CF-1042?"
      description="Photos, readings and reports will be permanently removed."
      confirmLabel="Delete"
      tone="danger"
      onConfirm={onConfirm}
    />,
  );
  return userEvent.click(screen.getByRole("button", { name: "Delete claim" }));
}

describe("ConfirmDialog", () => {
  it("is an alertdialog that focuses Cancel first", async () => {
    await renderDeleteDialog(vi.fn());

    expect(screen.getByRole("alertdialog", { name: "Delete claim CF-1042?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("closes after a synchronous confirm", async () => {
    const onConfirm = vi.fn();
    await renderDeleteDialog(onConfirm);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("shows a loading state and blocks repeat submits while pending", async () => {
    const request = deferred();
    const onConfirm = vi.fn(() => request.promise);
    await renderDeleteDialog(onConfirm);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();

    request.resolve();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("stays open and shows the error when the action fails", async () => {
    const request = deferred();
    await renderDeleteDialog(() => request.promise);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    request.reject(new Error("Claim is locked by an open estimate."));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Claim is locked by an open estimate.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("cancels without confirming", async () => {
    const onConfirm = vi.fn();
    await renderDeleteDialog(onConfirm);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
