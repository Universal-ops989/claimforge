import { clsx } from "clsx";
import { Check, Minus } from "lucide-react";
import { Checkbox as RadixCheckbox } from "radix-ui";
import { useId, type ReactNode, type Ref } from "react";

import { useFieldControl } from "../field/field-context";
import styles from "./checkbox.module.css";

export type CheckedState = boolean | "indeterminate";

export interface CheckboxProps {
  /** Visible label. Omit only when the checkbox is labelled another way (e.g. `aria-label`). */
  label?: ReactNode;
  /** Secondary text under the label. */
  description?: ReactNode;
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  name?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** A single on/off choice, with an optional indeterminate state for "select all". */
export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  name,
  value,
  disabled,
  required,
  invalid,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  ref,
}: CheckboxProps) {
  const generatedId = useId();
  const descriptionId = `${generatedId}-description`;
  const field = useFieldControl({
    id,
    disabled,
    required,
    invalid,
    "aria-describedby": [ariaDescribedBy, description != null ? descriptionId : undefined]
      .filter(Boolean)
      .join(" "),
  });
  const controlId = field.id ?? generatedId;

  return (
    <div className={clsx(styles.root, field.disabled && styles.disabled, className)}>
      <RadixCheckbox.Root
        ref={ref}
        id={controlId}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        name={name}
        value={value}
        disabled={field.disabled}
        required={field.required}
        aria-label={ariaLabel}
        aria-invalid={field["aria-invalid"]}
        aria-describedby={field["aria-describedby"]}
        className={clsx(styles.box, field.invalid && styles.invalid)}
      >
        <RadixCheckbox.Indicator className={styles.indicator}>
          <Check className={styles.check} aria-hidden="true" />
          <Minus className={styles.dash} aria-hidden="true" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {(label != null || description != null) && (
        <div className={styles.text}>
          {label != null && (
            <label htmlFor={controlId} className={styles.label}>
              {label}
            </label>
          )}
          {description != null && (
            <span id={descriptionId} className={styles.description}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
