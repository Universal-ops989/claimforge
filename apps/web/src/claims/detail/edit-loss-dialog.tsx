import { isApiError } from "@claimforge/api-client";
import { useUpdateClaim } from "@claimforge/api-client/react";
import { Button, Dialog, DialogClose, DialogContent, Stack, Text } from "@claimforge/ui";
import { useId } from "react";
import { FormProvider, useForm } from "react-hook-form";

import { useOrganization } from "../../app/organization";
import { errorCopy } from "../../app/states";
import {
  EMPTY_DRAFT,
  lossOf,
  lossResolver,
  refusedFields,
  toClaimUpdate,
  type ClaimDraft,
} from "../new/draft";
import { LossStep } from "../new/steps";
import type { Claim } from "./tabs";

export interface EditLossDialogProps {
  claim: Claim;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edit what happened and who insures it: the new-claim form's loss step, with its checks,
 * on an existing claim. Opens with the claim as it is now.
 */
export function EditLossDialog({ claim, open, onOpenChange }: EditLossDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mounted only while open, so each opening starts from the claim as it is. */}
      {open && (
        <EditLossForm
          claim={claim}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function EditLossForm({ claim, onDone }: { claim: Claim; onDone: () => void }) {
  const organization = useOrganization();
  const update = useUpdateClaim(organization.id, claim.id);
  const formId = useId();
  const form = useForm<ClaimDraft>({
    defaultValues: { property: EMPTY_DRAFT.property, loss: lossOf(claim) },
    resolver: lossResolver,
    mode: "onTouched",
  });

  const save = form.handleSubmit(async ({ loss }) => {
    try {
      await update.mutateAsync(toClaimUpdate(loss));
    } catch (error) {
      for (const { field, message } of refusedFields(error)) {
        form.setError(field, { message });
      }
      return;
    }
    onDone();
  });

  const failure = update.error && refusedFields(update.error).length === 0 ? update.error : null;

  return (
    <DialogContent
      title="Edit loss and insurance"
      size="lg"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form
          id={formId}
          noValidate
          aria-label="Loss and insurance"
          onSubmit={(event) => {
            void save(event);
          }}
        >
          <Stack gap={4}>
            {failure && (
              <Text as="p" role="alert" tone="danger">
                {failureMessage(failure)}
              </Text>
            )}
            <LossStep />
          </Stack>
        </form>
      </FormProvider>
    </DialogContent>
  );
}

/** A refusal that isn't about one field, in words. */
function failureMessage(error: unknown): string {
  if (isApiError(error, "claim_locked")) {
    return "This claim was closed or cancelled, so its details can't be changed. Reopen it first.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
