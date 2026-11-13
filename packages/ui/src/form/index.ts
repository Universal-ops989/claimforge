/**
 * React Hook Form bindings for @claimforge/ui controls.
 *
 * Import from "@claimforge/ui/form" inside a react-hook-form `FormProvider`.
 * Kept in a separate entry so apps without react-hook-form never load it.
 */
export {
  FormCheckbox,
  FormCheckboxGroup,
  FormInput,
  FormRadioGroup,
  FormSelect,
  FormSwitch,
  FormTextarea,
} from "./form-fields";
export type {
  FormCheckboxGroupProps,
  FormCheckboxProps,
  FormInputProps,
  FormRadioGroupProps,
  FormSelectProps,
  FormSwitchProps,
  FormTextareaProps,
} from "./form-fields";
