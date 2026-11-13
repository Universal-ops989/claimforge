import { createContext, use } from "react";

/** State a form field shares with the control inside it. */
export interface FieldContextValue {
  id: string;
  /** Id of the visible label, for controls that compose their name with aria-labelledby. */
  labelId?: string | undefined;
  descriptionId?: string | undefined;
  errorId?: string | undefined;
  invalid: boolean;
  disabled: boolean;
  required: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

interface ControlA11yProps {
  id?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  invalid?: boolean | undefined;
  "aria-describedby"?: string | undefined;
}

/**
 * Merges a control's own props with the surrounding field's state, so controls work
 * standalone and inside `FormField`. Explicit props always win over the context.
 */
export function useFieldControl(props: ControlA11yProps) {
  const field = use(FieldContext);

  const invalid = props.invalid ?? field?.invalid ?? false;
  const describedBy =
    [props["aria-describedby"], field?.descriptionId, invalid ? field?.errorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return {
    id: props.id ?? field?.id,
    labelId: field?.labelId,
    disabled: props.disabled ?? field?.disabled,
    required: props.required ?? field?.required,
    invalid,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  };
}
