import { isApiError, type Schema } from "@claimforge/api-client";
import { useAssignClaim, useMembers, useUnassignClaim } from "@claimforge/api-client/react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  DialogClose,
  DialogContent,
  EmptyState,
  FormField,
  Inline,
  Select,
  Stack,
  Text,
} from "@claimforge/ui";
import { useId, useState } from "react";

import { useOrganization } from "../../app/organization";
import { errorCopy, QueryView } from "../../app/states";
import { dayOf } from "../../format/calendar-date";
import { ASSIGNMENT_ROLE_LABEL, rolesFor, type AssignmentRole } from "../team";
import type { Claim } from "./tabs";

type Member = Schema<"MemberRead">;

/**
 * Who is on the claim, as what, and since when; with `canChange`, assigning and removing
 * people too.
 */
export function TeamCard({ claim, canChange }: { claim: Claim; canChange: boolean }) {
  const organization = useOrganization();
  const unassign = useUnassignClaim(organization.id, claim.id);
  const [assigning, setAssigning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <Card role="region" aria-label="Team">
      <CardHeader
        headingLevel={2}
        title="Team"
        actions={
          canChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFailure(null);
                setAssigning(true);
              }}
            >
              Assign someone
            </Button>
          )
        }
      />
      <CardBody>
        <Stack gap={3}>
          {failure && (
            <Text as="p" role="alert" tone="danger">
              {failure}
            </Text>
          )}
          {claim.assignments.length === 0 ? (
            <EmptyState
              size="compact"
              headingLevel={3}
              title="Nobody yet"
              description="Assign an adjuster to take the claim on."
            />
          ) : (
            <Stack
              as="ul"
              gap={3}
              aria-label="Team"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {claim.assignments.map((assignment) => (
                <li key={assignment.user.id}>
                  <Inline justify="between" align="center" gap={3}>
                    <Stack gap={1}>
                      <Text>{assignment.user.full_name}</Text>
                      <Text size="sm" tone="muted">
                        {`${ASSIGNMENT_ROLE_LABEL[assignment.role]} · since ${dayOf(assignment.assigned_at)}`}
                      </Text>
                    </Stack>
                    {canChange && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${assignment.user.full_name} from the claim`}
                        onClick={() => {
                          setFailure(null);
                          unassign.mutate(assignment.user.id, {
                            onError: (error) => {
                              setFailure(
                                `${assignment.user.full_name} is still on the claim. ${message(error)}`,
                              );
                            },
                          });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </Inline>
                </li>
              ))}
            </Stack>
          )}
        </Stack>
      </CardBody>
      <Dialog open={assigning} onOpenChange={setAssigning}>
        {assigning && (
          <AssignForm
            claim={claim}
            onDone={() => {
              setAssigning(false);
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}

function AssignForm({ claim, onDone }: { claim: Claim; onDone: () => void }) {
  const organization = useOrganization();
  const members = useMembers(organization.id);
  return (
    <DialogContent
      title="Assign someone"
      description="Put a member of your organization on this claim."
      size="md"
    >
      <QueryView query={members}>
        {(list) => <AssignFields claim={claim} members={list} onDone={onDone} />}
      </QueryView>
    </DialogContent>
  );
}

function AssignFields({
  claim,
  members,
  onDone,
}: {
  claim: Claim;
  members: Member[];
  onDone: () => void;
}) {
  const organization = useOrganization();
  const assign = useAssignClaim(organization.id, claim.id);
  const formId = useId();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AssignmentRole | "">("");
  const [missing, setMissing] = useState(false);

  // Someone already on the claim is taken off first to change their role, so isn't offered.
  const onClaim = new Set(claim.assignments.map((a) => a.user.id));
  const available = members.filter(
    (m) => !onClaim.has(m.user.id) && rolesFor(m.permissions).length > 0,
  );
  const chosen = available.find((m) => m.user.id === userId);
  const roles = chosen ? rolesFor(chosen.permissions) : [];
  const adjuster = claim.assignments.find((a) => a.role === "adjuster");

  if (available.length === 0) {
    return (
      <Stack gap={4}>
        <Text as="p">Everyone who can work on claims is already on this one.</Text>
        <Inline justify="end">
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </Inline>
      </Stack>
    );
  }

  const submit = async () => {
    if (!chosen || !role) {
      setMissing(true);
      return;
    }
    try {
      await assign.mutateAsync({ user_id: chosen.user.id, role });
    } catch {
      return;
    }
    onDone();
  };

  return (
    <form
      id={formId}
      noValidate
      aria-label="Assign someone"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Stack gap={4}>
        {assign.error && (
          <Text as="p" role="alert" tone="danger">
            {assignFailure(assign.error, chosen, role)}
          </Text>
        )}
        <FormField label="Who" required error={missing && !chosen ? "Choose someone." : undefined}>
          <Select
            placeholder="Choose a member"
            options={available.map((m) => ({ value: m.user.id, label: m.user.full_name }))}
            value={userId}
            onValueChange={(value) => {
              setUserId(value);
              // Keep the role only if the new choice can take it.
              const next = available.find((m) => m.user.id === value);
              if (role && !(next && rolesFor(next.permissions).includes(role))) setRole("");
            }}
          />
        </FormField>
        <FormField
          label="As"
          required
          hint={
            role === "adjuster" && adjuster
              ? `Replaces ${adjuster.user.full_name}: a claim has one adjuster.`
              : chosen
                ? undefined
                : "Choose someone first."
          }
          error={missing && chosen && !role ? "Choose a role." : undefined}
        >
          <Select
            placeholder="Choose a role"
            disabled={!chosen}
            options={roles.map((r) => ({ value: r, label: ASSIGNMENT_ROLE_LABEL[r] }))}
            value={role}
            onValueChange={(value) => {
              setRole(value as AssignmentRole);
            }}
          />
        </FormField>
        <Inline justify="end" gap={3}>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={assign.isPending}>
            Assign
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}

/** An assignment the API refused, in words. */
function assignFailure(
  error: unknown,
  member: Member | undefined,
  role: AssignmentRole | "",
): string {
  const name = member?.user.full_name ?? "They";
  if (isApiError(error, "already_assigned")) {
    return `${name} is already on this claim. Remove them first to give them another role.`;
  }
  if (isApiError(error, "assignee_lacks_permission")) {
    const as = role ? ` as ${ASSIGNMENT_ROLE_LABEL[role].toLowerCase()}` : "";
    return `${name} can't be assigned${as}: their role in the organization doesn't allow it.`;
  }
  if (isApiError(error, "unknown_assignee")) {
    return `${name} isn't a member of this organization any more.`;
  }
  return message(error);
}

function message(error: unknown): string {
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
