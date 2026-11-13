import { clsx } from "clsx";
import { useState, type ReactNode } from "react";

import { Checkbox } from "./checkbox";
import styles from "./checkbox.module.css";

export interface CheckboxGroupOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface CheckboxGroupProps {
  /** Group label, rendered as the fieldset legend. */
  label: ReactNode;
  options: CheckboxGroupOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Form field name shared by every checkbox. */
  name?: string;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

/** Several related on/off choices under one label, e.g. "Affected areas". */
export function CheckboxGroup({
  label,
  options,
  value,
  defaultValue = [],
  onValueChange,
  name,
  orientation = "vertical",
  disabled = false,
  invalid,
  className,
}: CheckboxGroupProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const selected = value ?? uncontrolled;

  const toggle = (optionValue: string, checked: boolean) => {
    const next = checked
      ? [...selected, optionValue]
      : selected.filter((item) => item !== optionValue);
    // Keep the order of `options` so the result is stable regardless of click order.
    const ordered = options.map((o) => o.value).filter((v) => next.includes(v));
    setUncontrolled(ordered);
    onValueChange?.(ordered);
  };

  return (
    <fieldset className={clsx(styles.group, className)} disabled={disabled}>
      <legend className={styles.legend}>{label}</legend>
      <div className={clsx(styles.options, orientation === "horizontal" && styles.horizontal)}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            name={name}
            value={option.value}
            label={option.label}
            description={option.description}
            disabled={disabled || option.disabled}
            invalid={invalid}
            checked={selected.includes(option.value)}
            onCheckedChange={(checked) => {
              toggle(option.value, checked === true);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
