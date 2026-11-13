import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FileDropzone } from "./file-dropzone";
import { FileUploadList } from "./file-upload-list";
import { formatBytes, matchesAccept, validateFiles } from "./file-validation";

const file = (name: string, type: string, size = 1000) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [10 * 1024 * 1024, "10 MB"],
    [3.25 * 1024 ** 3, "3.3 GB"],
  ])("%i -> %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("matchesAccept", () => {
  it("supports wildcards, exact types and extensions", () => {
    expect(matchesAccept(file("a.jpg", "image/jpeg"), "image/*")).toBe(true);
    expect(matchesAccept(file("a.pdf", "application/pdf"), "image/*")).toBe(false);
    expect(matchesAccept(file("a.PDF", ""), ".pdf")).toBe(true);
    expect(matchesAccept(file("a.csv", "text/csv"), "image/*, text/csv")).toBe(true);
    expect(matchesAccept(file("a.exe", "application/x-msdownload"), undefined)).toBe(true);
  });
});

describe("validateFiles", () => {
  it("rejects by type, size and count with reasons", () => {
    const result = validateFiles(
      [
        file("kitchen.jpg", "image/jpeg"),
        file("notes.docx", "application/msword"),
        file("huge.jpg", "image/jpeg", 50_000_000),
        file("hall.jpg", "image/jpeg"),
        file("bath.jpg", "image/jpeg"),
      ],
      { accept: "image/*", maxSize: 10 * 1024 * 1024, maxFiles: 2 },
    );

    expect(result.accepted.map((f) => f.name)).toEqual(["kitchen.jpg", "hall.jpg"]);
    expect(result.rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ["notes.docx", "type"],
      ["huge.jpg", "size"],
      ["bath.jpg", "count"],
    ]);
  });
});

describe("FileDropzone", () => {
  it("accepts browsed files and reports rejections", async () => {
    const onFilesAccepted = vi.fn();
    const onFilesRejected = vi.fn();
    render(
      <FileDropzone
        accept="image/*"
        onFilesAccepted={onFilesAccepted}
        onFilesRejected={onFilesRejected}
      />,
    );

    // Browsers can bypass `accept` (e.g. "All files" in the dialog), so validate anyway.
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByTestId("file-input"), [
      file("kitchen.jpg", "image/jpeg"),
      file("notes.txt", "text/plain"),
    ]);

    expect(onFilesAccepted).toHaveBeenCalledWith([
      expect.objectContaining({ name: "kitchen.jpg" }),
    ]);
    expect(onFilesRejected).toHaveBeenCalledWith([expect.objectContaining({ reason: "type" })]);
    expect(screen.getByRole("alert")).toHaveTextContent("notes.txt isn't a supported file type");
  });

  it("opens the file dialog from a real button described by the rules", () => {
    render(<FileDropzone accept="image/*" maxSize={1024 * 1024} onFilesAccepted={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Browse files" })).toHaveAccessibleDescription(
      "image/* · up to 1 MB each",
    );
  });

  it("accepts dropped files and highlights while dragging", () => {
    const onFilesAccepted = vi.fn();
    render(<FileDropzone onFilesAccepted={onFilesAccepted} />);
    const zone = screen.getByTestId("file-dropzone");

    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    expect(zone).toHaveClass("dragging");

    fireEvent.drop(zone, { dataTransfer: { files: [file("reading.csv", "text/csv")] } });
    expect(zone).not.toHaveClass("dragging");
    expect(onFilesAccepted).toHaveBeenCalledWith([
      expect.objectContaining({ name: "reading.csv" }),
    ]);
  });

  it("limits single-file pickers to one file", () => {
    const onFilesAccepted = vi.fn();
    render(<FileDropzone multiple={false} onFilesAccepted={onFilesAccepted} />);

    fireEvent.drop(screen.getByTestId("file-dropzone"), {
      dataTransfer: { files: [file("a.pdf", "application/pdf"), file("b.pdf", "application/pdf")] },
    });

    expect(onFilesAccepted).toHaveBeenCalledWith([expect.objectContaining({ name: "a.pdf" })]);
  });
});

describe("FileUploadList", () => {
  it("shows progress, completion and errors with retry and remove", async () => {
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    render(
      <FileUploadList
        onRetry={onRetry}
        onRemove={onRemove}
        items={[
          {
            id: "1",
            name: "kitchen.jpg",
            size: 2_400_000,
            type: "image/jpeg",
            status: "uploading",
            progress: 42,
          },
          { id: "2", name: "hall.jpg", size: 1_100_000, type: "image/jpeg", status: "done" },
          {
            id: "3",
            name: "bath.jpg",
            size: 900_000,
            type: "image/jpeg",
            status: "error",
            error: "Network error",
          },
        ]}
      />,
    );

    expect(screen.getByRole("progressbar", { name: "Uploading kitchen.jpg" })).toHaveAttribute(
      "aria-valuenow",
      "42",
    );
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");

    await userEvent.click(screen.getByRole("button", { name: "Retry bath.jpg" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove hall.jpg" }));
    expect(onRetry).toHaveBeenCalledWith("3");
    expect(onRemove).toHaveBeenCalledWith("2");
  });
});
