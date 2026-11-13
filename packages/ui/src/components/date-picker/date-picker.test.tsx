import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FormField } from "../field/form-field";
import { DatePicker, DateRangePicker, type DateRange } from "./date-picker";
import { formatDisplayDate, fromIsoDate, toIsoDate } from "./date-utils";

describe("date utils", () => {
  it("round-trips ISO dates on the local calendar day", () => {
    const date = fromIsoDate("2026-11-02");
    if (!date) throw new Error("expected a valid date");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(2);
    expect(toIsoDate(date)).toBe("2026-11-02");
    expect(formatDisplayDate(date)).toBe("Nov 2, 2026");
  });

  it("rejects empty and invalid values", () => {
    expect(fromIsoDate(null)).toBeUndefined();
    expect(fromIsoDate("2026-13-40")).toBeUndefined();
    expect(fromIsoDate("not a date")).toBeUndefined();
  });
});

function ControlledDate(props: {
  initial?: string | null;
  onChange?: (v: string | null) => void;
  max?: string;
}) {
  const [value, setValue] = useState<string | null>(props.initial ?? null);
  return (
    <FormField label="Date of loss">
      <DatePicker
        value={value}
        max={props.max}
        onChange={(next) => {
          setValue(next);
          props.onChange?.(next);
        }}
      />
    </FormField>
  );
}

describe("DatePicker", () => {
  it("names the trigger with the label and the current value", () => {
    render(<ControlledDate initial="2026-11-02" />);

    expect(screen.getByRole("button", { name: "Date of loss Nov 2, 2026" })).toBeInTheDocument();
  });

  it("shows the placeholder when empty", () => {
    render(<ControlledDate />);

    expect(screen.getByRole("button", { name: "Date of loss Select date" })).toBeInTheDocument();
  });

  it("selects a date from the calendar and closes", async () => {
    const onChange = vi.fn();
    render(<ControlledDate initial="2026-11-02" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /Date of loss/ }));
    expect(screen.getByRole("dialog", { name: "Choose date" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /November 12th, 2026/ }));

    expect(onChange).toHaveBeenCalledWith("2026-11-12");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Date of loss/ })).toHaveTextContent("Nov 12, 2026");
  });

  it("disables dates after max", async () => {
    render(<ControlledDate initial="2026-11-02" max="2026-11-10" />);

    await userEvent.click(screen.getByRole("button", { name: /Date of loss/ }));

    expect(screen.getByRole("button", { name: /November 11th, 2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /November 10th, 2026/ })).toBeEnabled();
  });

  it("clears the value", async () => {
    const onChange = vi.fn();
    render(<ControlledDate initial="2026-11-02" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Clear date" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("button", { name: "Clear date" })).not.toBeInTheDocument();
  });

  it("uses aria-label when standalone", () => {
    render(<DatePicker aria-label="Inspection date" value="2026-11-20" />);

    expect(
      screen.getByRole("button", { name: "Inspection date Nov 20, 2026" }),
    ).toBeInTheDocument();
  });
});

describe("DateRangePicker", () => {
  it("selects a start and end date", async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [range, setRange] = useState<DateRange>({ start: null, end: null });
      return (
        <DateRangePicker
          aria-label="Loss date"
          value={range}
          max="2026-11-30"
          numberOfMonths={1}
          onChange={(next) => {
            setRange(next);
            onChange(next);
          }}
        />
      );
    }
    render(<Controlled />);

    await userEvent.click(screen.getByRole("button", { name: /Loss date/ }));
    await userEvent.click(screen.getByRole("button", { name: /November 3rd, 2026/ }));
    await userEvent.click(screen.getByRole("button", { name: /November 9th, 2026/ }));

    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-11-03", end: "2026-11-09" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Loss date/ })).toHaveTextContent(
      "Nov 3, 2026 – Nov 9, 2026",
    );
  });
});
