import { clsx } from "clsx";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import type { Ref } from "react";

import { useFieldControl } from "../field/field-context";
import styles from "./select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  label: string;
  options: SelectOption[];
}

export type SelectSize = "sm" | "md" | "lg";

export interface SelectProps {
  /** Flat options, or groups of options with headings. */
  options: (SelectOption | SelectOptionGroup)[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shown when nothing is selected. */
  placeholder?: string;
  /** Form field name; a hidden native select keeps form submission working. */
  name?: string;
  size?: SelectSize;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  ref?: Ref<HTMLButtonElement>;
}

const isGroup = (item: SelectOption | SelectOptionGroup): item is SelectOptionGroup =>
  "options" in item;

function Item({ option }: { option: SelectOption }) {
  return (
    <RadixSelect.Item value={option.value} disabled={option.disabled} className={styles.item}>
      <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className={styles.indicator}>
        <Check aria-hidden="true" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}

/** Pick one value from a list. Keyboard navigation and typeahead included. */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  name,
  size = "md",
  invalid,
  disabled,
  required,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  ref,
}: SelectProps) {
  const field = useFieldControl({
    id,
    disabled,
    required,
    invalid,
    "aria-describedby": ariaDescribedBy,
  });

  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      disabled={field.disabled}
      required={field.required}
    >
      <RadixSelect.Trigger
        ref={ref}
        id={field.id}
        aria-label={ariaLabel}
        aria-invalid={field["aria-invalid"]}
        aria-describedby={field["aria-describedby"]}
        className={clsx(styles.trigger, styles[size], field.invalid && styles.invalid, className)}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className={styles.chevron}>
          <ChevronDown aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content className={styles.content} position="popper" sideOffset={4}>
          <RadixSelect.ScrollUpButton className={styles.scroll}>
            <ChevronUp aria-hidden="true" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className={styles.viewport}>
            {options.map((item, index) =>
              isGroup(item) ? (
                <RadixSelect.Group key={item.label}>
                  {index > 0 && <RadixSelect.Separator className={styles.separator} />}
                  <RadixSelect.Label className={styles.groupLabel}>{item.label}</RadixSelect.Label>
                  {item.options.map((option) => (
                    <Item key={option.value} option={option} />
                  ))}
                </RadixSelect.Group>
              ) : (
                <Item key={item.value} option={item} />
              ),
            )}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className={styles.scroll}>
            <ChevronDown aria-hidden="true" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
