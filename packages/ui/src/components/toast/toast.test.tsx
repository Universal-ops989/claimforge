import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "./toast-provider";
import { toast, toastStore } from "./toast-store";

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

describe("toast store", () => {
  it("adds, replaces by id and dismisses", () => {
    const id = toast.success("Saved");
    expect(toastStore.getSnapshot()).toMatchObject([{ id, title: "Saved", tone: "success" }]);

    toast({ id, title: "Saved again" });
    expect(toastStore.getSnapshot()).toHaveLength(1);
    expect(toastStore.getSnapshot()[0]?.title).toBe("Saved again");

    toast.dismiss(id);
    expect(toastStore.getSnapshot()).toHaveLength(0);
  });

  it("keeps errors until dismissed by default", () => {
    toast.error("Upload failed");

    expect(toastStore.getSnapshot()[0]).toMatchObject({ tone: "danger", duration: Infinity });
  });
});

describe("ToastProvider", () => {
  it("renders toasts raised from outside React", () => {
    render(<ToastProvider />);

    act(() => {
      toast.info("Inspection scheduled", { description: "Tue 10:00 with Dana Whitfield" });
    });

    expect(screen.getByText("Inspection scheduled")).toBeInTheDocument();
    expect(screen.getByText("Tue 10:00 with Dana Whitfield")).toBeInTheDocument();
  });

  it("runs the action and dismisses the toast", async () => {
    const undo = vi.fn();
    render(<ToastProvider />);
    act(() => {
      toast({ title: "Photo deleted", action: { label: "Undo", onClick: undo } });
    });

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(undo).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByText("Photo deleted")).not.toBeInTheDocument();
    });
  });

  it("dismisses from the close button", async () => {
    render(<ToastProvider />);
    act(() => {
      toast.warning("Reading overdue");
    });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));

    await waitFor(() => {
      expect(screen.queryByText("Reading overdue")).not.toBeInTheDocument();
    });
  });

  it("shows at most maxVisible toasts and reveals queued ones as others close", () => {
    render(<ToastProvider maxVisible={2} />);
    const ids: string[] = [];
    act(() => {
      ids.push(toast("One"), toast("Two"), toast("Three"));
    });

    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.queryByText("Three")).not.toBeInTheDocument();

    act(() => {
      toast.dismiss(ids[0]);
    });

    expect(screen.getByText("Three")).toBeInTheDocument();
  });

  it("auto-dismisses after the duration", async () => {
    render(<ToastProvider duration={50} />);
    act(() => {
      toast.success("Reading saved");
    });

    expect(screen.getByText("Reading saved")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Reading saved")).not.toBeInTheDocument();
    });
  });
});
