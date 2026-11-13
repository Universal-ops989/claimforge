import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders minRows and accepts input", async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="Notes" minRows={4} onChange={onChange} />);

    const textarea = screen.getByRole("textbox", { name: "Notes" });
    expect(textarea).toHaveAttribute("rows", "4");

    await userEvent.type(textarea, "Wet drywall");
    expect(onChange).toHaveBeenCalledTimes(11);
  });

  it("forwards refs while keeping its own measurement ref", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea aria-label="Notes" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("counts characters for uncontrolled usage and links the counter", async () => {
    render(<Textarea aria-label="Notes" maxLength={10} showCount defaultValue="abc" />);

    const textarea = screen.getByRole("textbox");
    expect(screen.getByText("3 / 10")).toBeInTheDocument();

    await userEvent.type(textarea, "defghij");
    const counter = screen.getByText("10 / 10");
    expect(counter).toHaveClass("counterLimit");
    expect(textarea.getAttribute("aria-describedby")).toContain(counter.id);
  });

  it("counts characters for controlled usage", async () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Textarea
          aria-label="Notes"
          maxLength={50}
          showCount
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
        />
      );
    }
    render(<Controlled />);

    await userEvent.type(screen.getByRole("textbox"), "Mold");

    expect(screen.getByText("4 / 50")).toBeInTheDocument();
  });

  it("does not render a counter without maxLength", () => {
    render(<Textarea aria-label="Notes" showCount />);

    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it("marks invalid state", () => {
    render(<Textarea aria-label="Notes" invalid />);

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});
