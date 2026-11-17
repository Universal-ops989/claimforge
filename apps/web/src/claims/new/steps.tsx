import { DatePicker, FormField, Grid, Stack } from "@claimforge/ui";
import { FormInput, FormSelect, FormTextarea } from "@claimforge/ui/form";
import { Controller, useFormContext } from "react-hook-form";

import { LOSS_TYPE_LABEL } from "../status";
import { localToday, type ClaimDraft, type DraftField } from "./draft";

/** The fields each form step owns: what its Next checks. */
export const STEP_FIELDS: Record<"property" | "loss", DraftField[]> = {
  property: [
    "property.line1",
    "property.line2",
    "property.city",
    "property.region",
    "property.postal_code",
    "property.property_type",
    "property.year_built",
    "property.access_notes",
  ],
  loss: [
    "loss.loss_type",
    "loss.loss_date",
    "loss.description",
    "loss.carrier_name",
    "loss.policy_number",
    "loss.carrier_claim_number",
  ],
};

const PROPERTY_TYPES = [
  { value: "residential", label: "Residential" },
  { value: "multi_family", label: "Multi-family" },
  { value: "commercial", label: "Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "other", label: "Other" },
];

const LOSS_TYPES = (Object.keys(LOSS_TYPE_LABEL) as (keyof typeof LOSS_TYPE_LABEL)[]).map(
  (value) => ({ value, label: LOSS_TYPE_LABEL[value] }),
);

/** Where the damage is. */
export function PropertyStep() {
  return (
    <Stack gap={4}>
      <FormInput<ClaimDraft>
        name="property.line1"
        label="Street address"
        autoComplete="address-line1"
        required
      />
      <FormInput<ClaimDraft>
        name="property.line2"
        label="Apartment, suite, unit"
        autoComplete="address-line2"
      />
      <Grid minChildWidth="12rem" gap={4}>
        <FormInput<ClaimDraft>
          name="property.city"
          label="City"
          autoComplete="address-level2"
          required
        />
        <FormInput<ClaimDraft>
          name="property.region"
          label="State or region"
          autoComplete="address-level1"
        />
        <FormInput<ClaimDraft>
          name="property.postal_code"
          label="Postal code"
          autoComplete="postal-code"
        />
      </Grid>
      <Grid minChildWidth="12rem" gap={4}>
        <FormSelect<ClaimDraft>
          name="property.property_type"
          label="Property type"
          options={PROPERTY_TYPES}
        />
        <FormInput<ClaimDraft>
          name="property.year_built"
          label="Year built"
          inputMode="numeric"
          hint="If known"
        />
      </Grid>
      <FormTextarea<ClaimDraft>
        name="property.access_notes"
        label="Access notes"
        hint="Gate codes, pets, where to park"
        rows={3}
      />
    </Stack>
  );
}

/** What happened, and who insures it. */
export function LossStep() {
  const { control } = useFormContext<ClaimDraft>();
  return (
    <Stack gap={4}>
      <Grid minChildWidth="12rem" gap={4}>
        <FormSelect<ClaimDraft>
          name="loss.loss_type"
          label="Cause of loss"
          placeholder="Choose one"
          options={LOSS_TYPES}
          required
        />
        <Controller
          control={control}
          name="loss.loss_date"
          render={({ field, fieldState }) => (
            <FormField label="Date of loss" hint="If known" error={fieldState.error?.message}>
              <DatePicker
                value={field.value || null}
                onChange={(value) => {
                  field.onChange(value ?? "");
                }}
                max={localToday()}
                placeholder="Pick a date"
              />
            </FormField>
          )}
        />
      </Grid>
      <FormTextarea<ClaimDraft>
        name="loss.description"
        label="What happened"
        hint="What the policyholder told you, and what you've seen"
        rows={4}
      />
      <Grid minChildWidth="12rem" gap={4}>
        <FormInput<ClaimDraft> name="loss.carrier_name" label="Insurance carrier" />
        <FormInput<ClaimDraft> name="loss.policy_number" label="Policy number" />
        <FormInput<ClaimDraft> name="loss.carrier_claim_number" label="Carrier's claim number" />
      </Grid>
    </Stack>
  );
}
