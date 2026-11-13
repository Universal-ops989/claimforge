import { clsx } from "clsx";
import { RadioGroup as RadixRadioGroup } from "radix-ui";
import { useId, type ReactNode, type Ref } from "react";

import styles from "./radio-group.module.css";

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Group label. Required for accessibility; hide it visually with `hideLabel`. */
  label: ReactNode;
  hideLabel?: boolean;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  /** `card` renders each option as a bordered, full-width tile. */
  variant?: "default" | "card";
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-describedby"?: string;
  ref?: Ref<HTMLDivElement>;
}

/** Choose exactly one option. Arrow keys move between options. */
export function RadioGroup({
  label,
  hideLabel = false,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  variant = "default",
  orientation = "vertical",
  disabled,
  required,
  invalid = false,
  className,
  "aria-describedby": ariaDescribedBy,
  ref,
}: RadioGroupProps) {
  const id = useId();
  const labelId = `${id}-label`;

  return (
    <div className={clsx(styles.root, className)}>
      <div id={labelId} className={clsx(styles.legend, hideLabel && styles.hidden)}>
        {label}
      </div>
      <RadixRadioGroup.Root
        ref={ref}
        aria-labelledby={labelId}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        name={name}
        disabled={disabled}
        required={required}
        orientation={orientation}
        className={clsx(
          styles.options,
          orientation === "horizontal" && styles.horizontal,
          variant === "card" && styles.cards,
        )}
      >
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          const descriptionId = option.description != null ? `${optionId}-description` : undefined;
          return (
            <div
              key={option.value}
              className={clsx(
                styles.option,
                variant === "card" && styles.card,
                (disabled === true || option.disabled === true) && styles.disabled,
              )}
            >
              <RadixRadioGroup.Item
                id={optionId}
                value={option.value}
                disabled={option.disabled}
                aria-describedby={descriptionId}
                className={clsx(styles.radio, invalid && styles.invalid)}
              >
                <RadixRadioGroup.Indicator className={styles.dot} />
              </RadixRadioGroup.Item>
              <div className={styles.text}>
                <label htmlFor={optionId} className={styles.label}>
                  {option.label}
                </label>
                {option.description != null && (
                  <span id={descriptionId} className={styles.description}>
                    {option.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </RadixRadioGroup.Root>
    </div>
  );
}
