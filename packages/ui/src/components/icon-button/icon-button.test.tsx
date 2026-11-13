import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Trash2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { Icon } from "../icon/icon";
import { IconButton } from "./icon-button";

describe("IconButton", () => {
  it("uses the label as the accessible name and native tooltip", () => {
    render(<IconButton icon={<Icon icon={Trash2} />} label="Delete photo" />);

    const button = screen.getByRole("button", { name: "Delete photo" });
    expect(button).toHaveAttribute("title", "Delete photo");
    expect(button).toHaveClass("ghost");
  });

  it("can omit the native tooltip", () => {
    render(<IconButton icon={<Icon icon={Trash2} />} label="Delete" showTitle={false} />);

    expect(screen.getByRole("button", { name: "Delete" })).not.toHaveAttribute("title");
  });

  it("forwards clicks", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={<Icon icon={Trash2} />} label="Delete" onClick={onClick} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("Icon", () => {
  it("is decorative by default", () => {
    const { container } = render(<Icon icon={Trash2} />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is exposed as an image when labelled", () => {
    render(<Icon icon={Trash2} label="Deleted" />);

    expect(screen.getByRole("img", { name: "Deleted" })).toHaveClass("root", "md");
  });
});
