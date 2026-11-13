import { clsx } from "clsx";
import { Switch as RadixSwitch } from "radix-ui";
import { useId, type ReactNode, type Ref } from "react";

import { useFieldControl } from "../field/field-context";
import styles from "./switch.module.css";

export interface SwitchProps {
  label?: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "sm" | "md";
  /** Put the label before the switch, e.g. in settings lists. */
  labelPosition?: "start" | "end";
  name?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * An on/off toggle for settings that take effect immediately.
 * Use a Checkbox instead when the choice is only applied on form submit.
 */
export function Switch({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  size = "md",
  labelPosition = "end",
  name,
  value,
  disabled,
  required,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  ref,
}: SwitchProps) {
  const generatedId = useId();
  const descriptionId = `${generatedId}-description`;
  const field = useFieldControl({
    id,
    disabled,
    required,
    "aria-describedby": [ariaDescribedBy, description != null ? descriptionId : undefined]
      .filter(Boolean)
      .join(" "),
  });
  const controlId = field.id ?? generatedId;

  return (
    <div
      className={clsx(
        styles.root,
        labelPosition === "start" && styles.labelStart,
        field.disabled && styles.disabled,
        className,
      )}
    >
      <RadixSwitch.Root
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
        aria-describedby={field["aria-describedby"]}
        className={clsx(styles.track, styles[size])}
      >
        <RadixSwitch.Thumb className={styles.thumb} />
      </RadixSwitch.Root>
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
