import { clsx } from "clsx";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { useFieldControl } from "../field/field-context";
import styles from "./input.module.css";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<ComponentPropsWithRef<"input">, "size" | "prefix"> {
  size?: InputSize;
  /** Marks the value as invalid (red border, `aria-invalid`). Inherited from `FormField`. */
  invalid?: boolean;
  /** Content before the value, e.g. a search icon or "$". Decorative. */
  prefix?: ReactNode;
  /** Content after the value, e.g. a unit like "%" or "sq ft". Decorative. */
  suffix?: ReactNode;
}

/** Single-line text input. Works standalone or inside `FormField`. */
export function Input({
  size = "md",
  invalid,
  prefix,
  suffix,
  className,
  id,
  disabled,
  required,
  "aria-describedby": ariaDescribedBy,
  type = "text",
  ...props
}: InputProps) {
  const field = useFieldControl({
    id,
    disabled,
    required,
    invalid,
    "aria-describedby": ariaDescribedBy,
  });

  return (
    <div
      className={clsx(
        styles.root,
        styles[size],
        field.invalid && styles.invalid,
        field.disabled && styles.disabled,
        className,
      )}
    >
      {prefix != null && (
        <span className={styles.adornment} aria-hidden="true">
          {prefix}
        </span>
      )}
      <input
        type={type}
        className={styles.input}
        id={field.id}
        disabled={field.disabled}
        required={field.required}
        aria-invalid={field["aria-invalid"]}
        aria-describedby={field["aria-describedby"]}
        {...props}
      />
      {suffix != null && (
        <span className={styles.adornment} aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
}
