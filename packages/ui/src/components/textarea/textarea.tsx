import { clsx } from "clsx";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type CSSProperties,
} from "react";

import { mergeRefs } from "../../utils/merge-refs";
import { useFieldControl } from "../field/field-context";
import styles from "./textarea.module.css";

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
  /** Grow with the content instead of scrolling. On by default. */
  autoResize?: boolean;
  /** Visible rows when empty. */
  minRows?: number;
  /** Stop growing after this many rows and scroll instead. */
  maxRows?: number;
  /** Show a "used / max" counter. Requires `maxLength`. */
  showCount?: boolean;
}

/** Multi-line text input for notes and descriptions. */
export function Textarea({
  invalid,
  autoResize = true,
  minRows = 3,
  maxRows,
  showCount = false,
  maxLength,
  className,
  style,
  id,
  disabled,
  required,
  "aria-describedby": ariaDescribedBy,
  value,
  defaultValue,
  onChange,
  ref,
  ...props
}: TextareaProps) {
  const counterId = useId();
  const counting = showCount && maxLength !== undefined;
  const field = useFieldControl({
    id,
    disabled,
    required,
    invalid,
    "aria-describedby": [ariaDescribedBy, counting ? counterId : undefined]
      .filter(Boolean)
      .join(" "),
  });

  const innerRef = useRef<HTMLTextAreaElement>(null);
  const mergedRef = useMemo(() => mergeRefs(innerRef, ref), [ref]);
  const [uncontrolledLength, setUncontrolledLength] = useState(
    () => String(defaultValue ?? "").length,
  );
  const length = value !== undefined ? String(value).length : uncontrolledLength;

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    el.style.height = "auto";
    el.style.height = `${String(el.scrollHeight)}px`;
  }, [autoResize]);

  // Re-measure whenever the content changes, including controlled updates.
  useLayoutEffect(() => {
    resize();
  }, [resize, value, uncontrolledLength]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setUncontrolledLength(event.target.value.length);
    onChange?.(event);
  };

  return (
    <div className={clsx(styles.root, className)}>
      <textarea
        ref={mergedRef}
        className={clsx(
          styles.textarea,
          field.invalid && styles.invalid,
          autoResize && styles.autoResize,
        )}
        style={
          {
            ...style,
            "--textarea-max-rows": maxRows,
          } as CSSProperties
        }
        rows={minRows}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        id={field.id}
        disabled={field.disabled}
        required={field.required}
        aria-invalid={field["aria-invalid"]}
        aria-describedby={field["aria-describedby"]}
        data-max-rows={maxRows !== undefined || undefined}
        {...props}
      />
      {counting && (
        <span
          id={counterId}
          className={clsx(styles.counter, length >= maxLength && styles.counterLimit)}
        >
          {length} / {maxLength}
        </span>
      )}
    </div>
  );
}
