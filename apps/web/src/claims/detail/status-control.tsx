import { isApiError } from "@claimforge/api-client";
import { useChangeClaimStatus } from "@claimforge/api-client/react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Text,
} from "@claimforge/ui";
import { FormTextarea } from "@claimforge/ui/form";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { FormProvider, useForm, type FieldErrors, type Resolver } from "react-hook-form";

import { useOrganization } from "../../app/organization";
import { errorCopy } from "../../app/states";
import { STATUS_LABEL, type ClaimStatus } from "../status";
import { mayMove, moveLabel, needsReason } from "../workflow";
import type { Claim } from "./tabs";

const REASON_LIMIT = 1000;

/** How the last move went, told under the header. */
type Outcome = { tone: "done" | "failed"; text: string } | null;

/**
 * The claim's status moves: a menu of where it can go, a reason first where the workflow
 * asks for one, and what happened, announced. No menu for someone who may not move it.
 */
export function StatusControl({ claim }: { claim: Claim }) {
  const organization = useOrganization();
  const change = useChangeClaimStatus(organization.id, claim.id);
  const [asking, setAsking] = useState<ClaimStatus | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const from = claim.status;

  /** Move the claim; returns whether it moved. */
  const move = async (to: ClaimStatus, reason?: string): Promise<boolean> => {
    setOutcome(null);
    try {
      await change.mutateAsync({ status: to, reason });
    } catch (error) {
      setOutcome({ tone: "failed", text: failureMessage(error) });
      return false;
    }
    setOutcome({ tone: "done", text: `Moved to ${STATUS_LABEL[to]}.` });
    return true;
  };

  // The menu goes when there's nowhere to go, but what just happened stays told: a claim
  // someone else moved meanwhile may have nowhere left this user can take it.
  const movable = mayMove(organization.permissions, from) && claim.next_statuses.length > 0;
  if (!movable && outcome === null) {
    return null;
  }

  return (
    <>
      {movable && (
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              loading={change.isPending}
              trailingIcon={<ChevronDown size={16} />}
            >
              Change status
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            {claim.next_statuses.map((to) => (
              <MenuItem
                key={to}
                tone={to === "cancelled" ? "danger" : "default"}
                onSelect={() => {
                  if (needsReason(from, to)) setAsking(to);
                  else void move(to);
                }}
              >
                {needsReason(from, to) ? `${moveLabel(from, to)}…` : moveLabel(from, to)}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
      {/* Always there, so screen readers announce what's put in it. */}
      <Text as="p" size="sm" role="status" style={{ flexBasis: "100%" }}>
        {outcome?.tone === "done" ? outcome.text : ""}
      </Text>
      {outcome?.tone === "failed" && (
        <Text as="p" size="sm" role="alert" tone="danger" style={{ flexBasis: "100%" }}>
          {outcome.text}
        </Text>
      )}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
      >
        {asking !== null && (
          <ReasonForm
            title={moveLabel(from, asking)}
            pending={change.isPending}
            onSubmit={async (reason) => {
              if (await move(asking, reason)) setAsking(null);
            }}
          />
        )}
      </Dialog>
    </>
  );
}

interface ReasonValues {
  reason: string;
}

/** A reason is needed: blank (or only spaces) won't do. */
const reasonResolver: Resolver<ReasonValues> = (values) => {
  const errors: FieldErrors<ReasonValues> = values.reason.trim()
    ? {}
    : { reason: { type: "required", message: "Say why." } };
  return errors.reason ? { values: {}, errors } : { values, errors: {} };
};

/** Asks why, for a move the workflow wants explained. */
function ReasonForm({
  title,
  pending,
  onSubmit,
}: {
  title: string;
  pending: boolean;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const formId = useId();
  const form = useForm<ReasonValues>({
    defaultValues: { reason: "" },
    resolver: reasonResolver,
  });
  const submit = form.handleSubmit(({ reason }) => onSubmit(reason.trim()));
  return (
    <DialogContent
      title={title}
      description="Say why. It's kept with the claim's history."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={pending}>
            {title}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <FormTextarea<ReasonValues>
            name="reason"
            label="Reason"
            rows={3}
            maxLength={REASON_LIMIT}
            showCount
            required
          />
        </form>
      </FormProvider>
    </DialogContent>
  );
}

/** A refused move, in words. */
function failureMessage(error: unknown): string {
  if (isApiError(error, "status_changed")) {
    const now = (error.problem as Record<string, unknown>).current_status;
    const where =
      typeof now === "string" && now in STATUS_LABEL
        ? ` to ${STATUS_LABEL[now as ClaimStatus]}`
        : "";
    return `Someone else moved this claim${where} first. It's shown as it is now; choose again if it still needs to move.`;
  }
  if (isApiError(error, "invalid_status_transition")) {
    return "The claim can't go there from where it is now.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
