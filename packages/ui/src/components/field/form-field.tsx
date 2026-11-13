import { clsx } from "clsx";
import { CircleAlert } from "lucide-react";
import { useId, useMemo, type ReactNode } from "react";

import { FieldContext, type FieldContextValue } from "./field-context";
import styles from "./form-field.module.css";

export interface FormFieldProps {
  /** Visible label, connected to the control. */
  label: ReactNode;
  /** Keep the label for screen readers but hide it visually. */
  hideLabel?: boolean;
  /** Help text under the control. */
  hint?: ReactNode;
  /** Error message. Any non-empty value marks the control invalid. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Control id. Generated when omitted. */
  id?: string;
  /** Extra content at the end of the label row, e.g. a "Learn more" link. */
  labelAction?: ReactNode;
  className?: string;
  /** A single form control: Input, Textarea, Select, Checkbox or Switch. */
  children: ReactNode;
}

/**
 * Lays out a label, control, hint and error, and wires up ids,
 * `aria-describedby`, `aria-invalid`, `required` and `disabled` for the control.
 */
export function FormField({
  label,
  hideLabel = false,
  hint,
  error,
  required = false,
  disabled = false,
  id,
  labelAction,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hasHint = hint != null && hint !== false;
  const hasError = error != null && error !== false && error !== "";

  const context = useMemo<FieldContextValue>(
    () => ({
      id: controlId,
      descriptionId: hasHint ? `${controlId}-hint` : undefined,
      errorId: hasError ? `${controlId}-error` : undefined,
      invalid: hasError,
      disabled,
      required,
    }),
    [controlId, hasHint, hasError, disabled, required],
  );

  return (
    <div className={clsx(styles.root, disabled && styles.disabled, className)}>
      <div className={clsx(styles.labelRow, hideLabel && styles.hidden)}>
        <label htmlFor={controlId} className={styles.label}>
          {label}
          {required && (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          )}
        </label>
        {labelAction}
      </div>

      <FieldContext value={context}>{children}</FieldContext>

      {hasHint && (
        <p id={context.descriptionId} className={styles.hint}>
          {hint}
        </p>
      )}
      {hasError && (
        <p id={context.errorId} className={styles.error}>
          <CircleAlert aria-hidden="true" className={styles.errorIcon} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
