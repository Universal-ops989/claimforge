import { isApiError, type Schema } from "@claimforge/api-client";
import { useChangeEstimateStatus, useDeleteEstimate } from "@claimforge/api-client/react";
import { Button, ConfirmDialog, Inline, Text } from "@claimforge/ui";
import { useState } from "react";
import { useNavigate } from "react-router";

import { inOrganization, useOrganization } from "../../app/organization";
import { ESTIMATE_STATUS_LABEL, money, type Estimate, type EstimateStatus } from "../estimates";
import { READ_ONLY_STATUSES } from "../status";
import { message } from "./estimates-tab";
import { useClaimOfPage } from "./tabs";

/** A move from `from` to `to`, as people say it. */
export function estimateMoveLabel(from: EstimateStatus, to: EstimateStatus): string {
  if (to === "submitted") return "Submit";
  if (to === "approved") return "Approve";
  if (to === "rejected") return "Reject";
  // Back to draft: what that means depends on where it's coming from.
  if (from === "submitted") return "Withdraw";
  if (from === "rejected") return "Rework";
  return "Reopen";
}

/** The permission a move takes, as the API checks it. */
export function estimateMoveNeeds(from: EstimateStatus, to: EstimateStatus): Schema<"Permission"> {
  return to === "approved" || to === "rejected" || from === "approved"
    ? "estimates:approve"
    : "estimates:write";
}

/** Moves that ask first: the ones that decide, or undo a decision. */
const ASKS: EstimateStatus[] = ["approved", "rejected"];

/**
 * The estimate's workflow moves this person may make, and deleting a draft; each move
 * announced, a refusal told in words.
 */
export function EstimateWorkflow({ estimate }: { estimate: Estimate }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const navigate = useNavigate();
  const change = useChangeEstimateStatus(organization.id, claim.id, estimate.id);
  const remove = useDeleteEstimate(organization.id, claim.id);
  const [asking, setAsking] = useState<EstimateStatus | "delete" | null>(null);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const from = estimate.status;

  if (READ_ONLY_STATUSES.includes(claim.status)) return null;
  const moves = estimate.next_statuses.filter((to) =>
    organization.permissions.includes(estimateMoveNeeds(from, to)),
  );
  const canDelete = from === "draft" && organization.permissions.includes("estimates:write");

  const move = async (to: EstimateStatus) => {
    setOutcome(null);
    try {
      await change.mutateAsync(to);
    } catch (error) {
      setOutcome({ ok: false, text: refusal(error) });
      return;
    }
    setOutcome({
      ok: true,
      text: `Estimate ${String(estimate.number)} is ${ESTIMATE_STATUS_LABEL[to].toLowerCase()}.`,
    });
  };

  const asks = (to: EstimateStatus) => ASKS.includes(to) || (from === "approved" && to === "draft");
  const empty = from === "draft" && estimate.lines.length === 0;

  return (
    <Inline gap={2} align="center">
      {moves.map((to) => (
        <Button
          key={to}
          variant={
            to === "submitted" || to === "approved"
              ? "primary"
              : to === "rejected"
                ? "danger"
                : "secondary"
          }
          loading={change.isPending && change.variables === to}
          disabled={to === "submitted" && empty}
          onClick={() => {
            if (asks(to)) setAsking(to);
            else void move(to);
          }}
        >
          {estimateMoveLabel(from, to)}
        </Button>
      ))}
      {canDelete && (
        <Button
          variant="ghost"
          onClick={() => {
            setAsking("delete");
          }}
        >
          Delete draft
        </Button>
      )}
      {empty && moves.includes("submitted") && (
        <Text size="sm" tone="muted">
          Add a line before submitting.
        </Text>
      )}
      <Text as="p" size="sm" role="status" style={{ flexBasis: "100%", margin: 0 }}>
        {outcome?.ok ? outcome.text : ""}
      </Text>
      {outcome && !outcome.ok && (
        <Text as="p" size="sm" role="alert" tone="danger" style={{ flexBasis: "100%", margin: 0 }}>
          {outcome.text}
        </Text>
      )}
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
        tone={asking === "approved" ? "default" : "danger"}
        title={
          asking === "delete"
            ? `Delete estimate ${String(estimate.number)}?`
            : asking
              ? `${estimateMoveLabel(from, asking)} estimate ${String(estimate.number)}?`
              : ""
        }
        description={
          asking === "delete"
            ? `${estimate.title}, with its ${String(estimate.lines.length)} ${estimate.lines.length === 1 ? "line" : "lines"}. It hasn't been sent anywhere, so nothing else keeps it.`
            : asking === "draft"
              ? `It goes back to draft so it can change; its approval for ${money(estimate.total)} is undone.`
              : `${estimate.title}, for ${money(estimate.total)}.`
        }
        confirmLabel={
          asking === "delete" ? "Delete" : asking ? estimateMoveLabel(from, asking) : "Confirm"
        }
        cancelLabel="Not now"
        onConfirm={async () => {
          if (asking === "delete") {
            try {
              await remove.mutateAsync(estimate.id);
            } catch (error) {
              throw new Error(refusal(error), { cause: error });
            }
            await navigate(inOrganization(organization.slug, `claims/${claim.number}/estimates`));
          } else if (asking) {
            await move(asking);
          }
        }}
      />
    </Inline>
  );
}

function refusal(error: unknown): string {
  if (isApiError(error, "estimate_transition")) {
    return error.problem.detail || "The estimate can't move there from where it is.";
  }
  if (isApiError(error, "estimate_not_draft")) return "Only a draft can be deleted.";
  if (isApiError(error, "claim_locked")) return "The claim was closed or cancelled.";
  return message(error);
}
