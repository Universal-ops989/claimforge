import { useId, type ReactNode } from "react";
import {
  useController,
  useFormContext,
  useFormState,
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
} from "react-hook-form";

import { Checkbox, type CheckboxProps } from "../components/checkbox/checkbox";
import { CheckboxGroup, type CheckboxGroupProps } from "../components/checkbox/checkbox-group";
import { FormField } from "../components/field/form-field";
import { Input, type InputProps } from "../components/input/input";
import { RadioGroup, type RadioGroupProps } from "../components/radio-group/radio-group";
import { Select, type SelectProps } from "../components/select/select";
import { Switch, type SwitchProps } from "../components/switch/switch";
import { Textarea, type TextareaProps } from "../components/textarea/textarea";
import styles from "./form-fields.module.css";

interface FieldLayoutProps {
  label: ReactNode;
  hint?: ReactNode;
  hideLabel?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

interface NamedField<T extends FieldValues> {
  /** Path of the field in the form values, e.g. "policy.number". */
  name: FieldPath<T>;
}

/* ------------------------------------------------------------------------ */
/* Registered (uncontrolled) inputs                                          */
/* ------------------------------------------------------------------------ */

export type FormInputProps<T extends FieldValues = FieldValues> = NamedField<T> &
  FieldLayoutProps &
  Omit<InputProps, "name" | "required" | "disabled" | "className"> & {
    /** Extra react-hook-form register options, e.g. `{ valueAsNumber: true }`. */
    registerOptions?: RegisterOptions<T, FieldPath<T>>;
  };

/** `Input` registered with the surrounding `FormProvider`, inside a `FormField`. */
export function FormInput<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  hideLabel,
  required,
  disabled,
  className,
  registerOptions,
  ...inputProps
}: FormInputProps<T>) {
  const { register, getFieldState } = useFormContext<T>();
  // Subscribe to this field's state only, so errors re-render just this field.
  const formState = useFormState<T>({ name });
  const { error } = getFieldState(name, formState);

  return (
    <FormField
      label={label}
      hint={hint}
      hideLabel={hideLabel}
      required={required}
      disabled={disabled}
      error={error?.message}
      className={className}
    >
      <Input {...inputProps} {...register(name, registerOptions)} />
    </FormField>
  );
}

export type FormTextareaProps<T extends FieldValues = FieldValues> = NamedField<T> &
  FieldLayoutProps &
  Omit<TextareaProps, "name" | "required" | "disabled" | "className" | "value" | "defaultValue">;

/** `Textarea` registered with the surrounding `FormProvider`, inside a `FormField`. */
export function FormTextarea<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  hideLabel,
  required,
  disabled,
  className,
  ...textareaProps
}: FormTextareaProps<T>) {
  // Controlled so the character counter stays in sync with resets and setValue.
  const {
    field: { ref, name: fieldName, value, onChange, onBlur },
    fieldState,
  } = useController<T>({ name });

  return (
    <FormField
      label={label}
      hint={hint}
      hideLabel={hideLabel}
      required={required}
      disabled={disabled}
      error={fieldState.error?.message}
      className={className}
    >
      <Textarea
        {...textareaProps}
        name={fieldName}
        ref={ref}
        value={value ?? ""}
        onChange={onChange}
        onBlur={onBlur}
      />
    </FormField>
  );
}

/* ------------------------------------------------------------------------ */
/* Controlled inputs                                                         */
/* ------------------------------------------------------------------------ */

export type FormSelectProps<T extends FieldValues = FieldValues> = NamedField<T> &
  FieldLayoutProps &
  Omit<SelectProps, "name" | "value" | "defaultValue" | "onValueChange" | "required" | "disabled">;

/** `Select` bound to a form value through react-hook-form's controller. */
export function FormSelect<T extends FieldValues = FieldValues>({
  name,
  label,
  hint,
  hideLabel,
  required,
  disabled,
  className,
  ...selectProps
}: FormSelectProps<T>) {
  const {
    field: { ref, name: fieldName, value, onChange },
    fieldState,
  } = useController<T>({ name });

  return (
    <FormField
      label={label}
      hint={hint}
      hideLabel={hideLabel}
      required={required}
      disabled={disabled}
      error={fieldState.error?.message}
      className={className}
    >
      <Select
        {...selectProps}
        ref={ref}
        name={fieldName}
        // An empty string shows the placeholder; undefined would flip Radix to uncontrolled.
        value={value ?? ""}
        onValueChange={onChange}
      />
    </FormField>
  );
}

export type FormCheckboxProps<T extends FieldValues = FieldValues> = NamedField<T> &
  Omit<CheckboxProps, "name" | "checked" | "defaultChecked" | "onCheckedChange" | "invalid">;

/** A boolean form value as a `Checkbox`. */
export function FormCheckbox<T extends FieldValues = FieldValues>({
  name,
  ...checkboxProps
}: FormCheckboxProps<T>) {
  const {
    field: { ref, name: fieldName, value, onChange, onBlur },
    fieldState,
  } = useController<T>({ name });
  const errorId = useId();
  const error = fieldState.error?.message;

  return (
    <div className={styles.stack}>
      <Checkbox
        {...checkboxProps}
        ref={ref}
        name={fieldName}
        checked={value === true}
        onCheckedChange={(checked) => {
          onChange(checked === true);
          onBlur();
        }}
        invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
      />
      {error !== undefined && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export type FormSwitchProps<T extends FieldValues = FieldValues> = NamedField<T> &
  Omit<SwitchProps, "name" | "checked" | "defaultChecked" | "onCheckedChange">;

/** A boolean form value as a `Switch`. */
export function FormSwitch<T extends FieldValues = FieldValues>({
  name,
  ...switchProps
}: FormSwitchProps<T>) {
  const {
    field: { ref, name: fieldName, value, onChange, onBlur },
  } = useController<T>({ name });

  return (
    <Switch
      {...switchProps}
      ref={ref}
      name={fieldName}
      checked={value === true}
      onCheckedChange={(checked) => {
        onChange(checked);
        onBlur();
      }}
    />
  );
}

export type FormRadioGroupProps<T extends FieldValues = FieldValues> = NamedField<T> &
  Omit<RadioGroupProps, "name" | "value" | "defaultValue" | "onValueChange" | "invalid">;

/** A single-choice form value as a `RadioGroup`, with its error underneath. */
export function FormRadioGroup<T extends FieldValues = FieldValues>({
  name,
  ...radioProps
}: FormRadioGroupProps<T>) {
  const {
    field: { ref, name: fieldName, value, onChange, onBlur },
    fieldState,
  } = useController<T>({ name });
  const errorId = useId();
  const error = fieldState.error?.message;

  return (
    <div className={styles.stack}>
      <RadioGroup
        {...radioProps}
        ref={ref}
        name={fieldName}
        value={value ?? ""}
        onValueChange={(value) => {
          onChange(value);
          onBlur();
        }}
        invalid={error !== undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
      />
      {error !== undefined && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export type FormCheckboxGroupProps<T extends FieldValues = FieldValues> = NamedField<T> &
  Omit<CheckboxGroupProps, "name" | "value" | "defaultValue" | "onValueChange" | "invalid">;

/** A `string[]` form value as a `CheckboxGroup`, with its error underneath. */
export function FormCheckboxGroup<T extends FieldValues = FieldValues>({
  name,
  ...groupProps
}: FormCheckboxGroupProps<T>) {
  const {
    field: { name: fieldName, value, onChange, onBlur },
    fieldState,
  } = useController<T>({ name });
  const error = fieldState.error?.message;

  return (
    <div className={styles.stack}>
      <CheckboxGroup
        {...groupProps}
        name={fieldName}
        value={value ?? []}
        onValueChange={(value) => {
          onChange(value);
          onBlur();
        }}
        invalid={error !== undefined}
      />
      {error !== undefined && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
