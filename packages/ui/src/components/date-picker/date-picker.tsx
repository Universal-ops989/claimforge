import { clsx } from "clsx";
import { CalendarDays, X } from "lucide-react";
import { Popover as RadixPopover } from "radix-ui";
import { useId, useState, type ReactNode, type Ref } from "react";
import type { DateRange as DayRange } from "react-day-picker";

import { useFieldControl } from "../field/field-context";
import popoverStyles from "../popover/popover.module.css";
import { Calendar } from "./calendar";
import styles from "./date-picker.module.css";
import { formatDisplayDate, fromIsoDate, toIsoDate, type IsoDate } from "./date-utils";

interface CommonProps {
  /** Earliest selectable date (inclusive). */
  min?: IsoDate;
  /** Latest selectable date (inclusive), e.g. today for a date of loss. */
  max?: IsoDate;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  id?: string;
  /** Accessible name when not inside a FormField. */
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

function bounds(min?: IsoDate, max?: IsoDate) {
  const minDate = fromIsoDate(min);
  const maxDate = fromIsoDate(max);
  return {
    disabled: [...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])],
    startMonth: minDate,
    endMonth: maxDate,
  };
}

interface TriggerShellProps extends CommonProps {
  display: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  dialogLabel: string;
  children: ReactNode;
}

/** Shared trigger + popover + clear button used by both pickers. */
function PickerShell({
  display,
  open,
  onOpenChange,
  onClear,
  dialogLabel,
  placeholder = "Select date",
  disabled,
  invalid,
  required,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  className,
  ref,
  children,
}: TriggerShellProps) {
  const valueId = useId();
  const ownLabelId = useId();
  const field = useFieldControl({
    id,
    disabled,
    required,
    invalid,
    "aria-describedby": ariaDescribedBy,
  });
  const labelId = field.labelId ?? (ariaLabel ? ownLabelId : undefined);

  return (
    <div className={clsx(styles.root, className)}>
      {ariaLabel && !field.labelId && (
        <span id={ownLabelId} hidden>
          {ariaLabel}
        </span>
      )}
      <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
        <RadixPopover.Trigger asChild>
          <button
            ref={ref}
            type="button"
            id={field.id}
            disabled={field.disabled}
            // Name = label + current value, e.g. "Date of loss, Nov 2, 2026".
            aria-labelledby={labelId ? `${labelId} ${valueId}` : undefined}
            aria-describedby={field["aria-describedby"]}
            className={clsx(
              styles.trigger,
              field.invalid && styles.invalid,
              display === null && styles.placeholder,
              display !== null && styles.hasValue,
            )}
          >
            <CalendarDays aria-hidden="true" className={styles.icon} />
            <span id={valueId}>{display ?? placeholder}</span>
          </button>
        </RadixPopover.Trigger>
        <RadixPopover.Portal>
          <RadixPopover.Content
            aria-label={dialogLabel}
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className={clsx(popoverStyles.content, styles.popover)}
          >
            {children}
          </RadixPopover.Content>
        </RadixPopover.Portal>
      </RadixPopover.Root>
      {display !== null && !field.disabled && (
        <button type="button" className={styles.clear} aria-label="Clear date" onClick={onClear}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export interface DatePickerProps extends CommonProps {
  value?: IsoDate | null;
  onChange?: (value: IsoDate | null) => void;
}

/** Pick a single calendar date. Value is an ISO "YYYY-MM-DD" string. */
export function DatePicker({ value, onChange, min, max, ...props }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromIsoDate(value);

  return (
    <PickerShell
      {...props}
      display={selected ? formatDisplayDate(selected) : null}
      open={open}
      onOpenChange={setOpen}
      onClear={() => onChange?.(null)}
      dialogLabel="Choose date"
    >
      <Calendar
        mode="single"
        // WAI-ARIA date picker pattern: focus the selected day when the dialog opens.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        selected={selected}
        defaultMonth={selected ?? fromIsoDate(max) ?? fromIsoDate(min)}
        onSelect={(date) => {
          onChange?.(date ? toIsoDate(date) : null);
          setOpen(false);
        }}
        {...bounds(min, max)}
      />
    </PickerShell>
  );
}

export interface DateRange {
  start: IsoDate | null;
  end: IsoDate | null;
}

export interface DateRangePickerProps extends CommonProps {
  value?: DateRange;
  onChange?: (value: DateRange) => void;
  /** Months shown side by side. */
  numberOfMonths?: number;
}

/** Pick a start and end date, e.g. to filter claims by loss date. */
export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  numberOfMonths = 2,
  placeholder = "Select dates",
  ...props
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // The calendar fills both ends on the first click, so count clicks instead:
  // the first starts a range, the second completes it and closes the picker.
  const [choosingEnd, setChoosingEnd] = useState(false);
  const from = fromIsoDate(value?.start);
  const to = fromIsoDate(value?.end);
  const display = from ? `${formatDisplayDate(from)} – ${to ? formatDisplayDate(to) : "…"}` : null;

  return (
    <PickerShell
      {...props}
      placeholder={placeholder}
      display={display}
      open={open}
      onOpenChange={(next) => {
        setChoosingEnd(false);
        setOpen(next);
      }}
      onClear={() => onChange?.({ start: null, end: null })}
      dialogLabel="Choose date range"
    >
      <Calendar
        mode="range"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- see DatePicker
        autoFocus
        numberOfMonths={numberOfMonths}
        selected={{ from, to } satisfies DayRange}
        defaultMonth={from ?? fromIsoDate(max)}
        onSelect={(range) => {
          const next = {
            start: range?.from ? toIsoDate(range.from) : null,
            end: range?.to ? toIsoDate(range.to) : null,
          };
          onChange?.(next);
          if (choosingEnd) {
            setChoosingEnd(false);
            setOpen(false);
          } else {
            setChoosingEnd(true);
          }
        }}
        {...bounds(min, max)}
      />
    </PickerShell>
  );
}
