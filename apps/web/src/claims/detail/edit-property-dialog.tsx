import { useUpdateProperty } from "@claimforge/api-client/react";
import { Dialog, Text } from "@claimforge/ui";
import { FormProvider, useForm } from "react-hook-form";

import { FormDialog } from "../../app/form-dialog";
import { useOrganization } from "../../app/organization";
import { errorCopy } from "../../app/states";
import {
  EMPTY_DRAFT,
  propertyOf,
  propertyResolver,
  refusedPropertyFields,
  toPropertyUpdate,
  type ClaimDraft,
} from "../new/draft";
import { PropertyStep } from "../new/steps";
import type { Claim } from "./tabs";

export interface EditPropertyDialogProps {
  claim: Claim;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edit the claim's property: the new-claim form's property step, with its checks, filled
 * with the property as it is. A property can be on several claims; the change shows on all.
 */
export function EditPropertyDialog({ claim, open, onOpenChange }: EditPropertyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <EditPropertyForm
          claim={claim}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function EditPropertyForm({ claim, onDone }: { claim: Claim; onDone: () => void }) {
  const organization = useOrganization();
  const update = useUpdateProperty(organization.id);
  const form = useForm<ClaimDraft>({
    defaultValues: { property: propertyOf(claim.property), loss: EMPTY_DRAFT.loss },
    resolver: propertyResolver,
    mode: "onTouched",
  });

  const save = form.handleSubmit(async ({ property }) => {
    try {
      await update.mutateAsync({
        propertyId: claim.property.id,
        changes: toPropertyUpdate(property, claim.property.address.country),
      });
    } catch (error) {
      for (const { field, message } of refusedPropertyFields(error)) {
        form.setError(field, { message });
      }
      return;
    }
    onDone();
  });

  const failure =
    update.error && refusedPropertyFields(update.error).length === 0
      ? `${errorCopy(update.error).title}. ${errorCopy(update.error).description}`
      : null;

  return (
    <FormDialog
      title="Edit the property"
      submitLabel="Save changes"
      pending={update.isPending}
      failure={failure}
      onSubmit={() => save()}
      size="lg"
    >
      <Text as="p" tone="muted">
        Every claim at this property shows the change.
      </Text>
      <FormProvider {...form}>
        <PropertyStep />
      </FormProvider>
    </FormDialog>
  );
}
