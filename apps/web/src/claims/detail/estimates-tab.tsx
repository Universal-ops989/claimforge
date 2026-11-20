import { isApiError } from "@claimforge/api-client";
import { useCreateEstimate, useEstimates, usePriceLists } from "@claimforge/api-client/react";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  FormField,
  Inline,
  Input,
  Select,
  SkeletonText,
  Stack,
  Text,
} from "@claimforge/ui";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { FormDialog } from "../../app/form-dialog";
import { inOrganization, useOrganization } from "../../app/organization";
import { errorCopy, QueryView } from "../../app/states";
import { ESTIMATE_STATUS_LABEL, ESTIMATE_STATUS_TONE, money } from "../estimates";
import { READ_ONLY_STATUSES } from "../status";
import { useClaimOfPage } from "./tabs";

/** Whether this person can start and change estimates on this claim. */
export function useCanEstimate(): boolean {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  return (
    organization.permissions.includes("estimates:write") &&
    !READ_ONLY_STATUSES.includes(claim.status)
  );
}

/** The claim's estimates, by number, and starting a new one. */
export function EstimatesTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const estimates = useEstimates(organization.id, claim.id);
  const canEstimate = useCanEstimate();
  const [creating, setCreating] = useState(false);
  const base = inOrganization(organization.slug, `claims/${claim.number}/estimates`);

  return (
    <Stack gap={4}>
      {canEstimate && (
        <Inline justify="end">
          <Button
            variant="primary"
            onClick={() => {
              setCreating(true);
            }}
          >
            New estimate
          </Button>
        </Inline>
      )}
      <QueryView query={estimates} loading={<SkeletonText lines={3} />}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              headingLevel={2}
              title="No estimates yet"
              description="Start one, then add its lines from your price list or by hand."
            />
          ) : (
            <Stack
              as="ul"
              gap={3}
              aria-label="Estimates"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {list.map((estimate) => (
                <li key={estimate.id}>
                  <Inline justify="between" align="center" gap={3}>
                    <Inline gap={2} align="center">
                      <Link to={`${base}/${estimate.id}`}>
                        {`Estimate ${String(estimate.number)} · ${estimate.title}`}
                      </Link>
                      <Badge tone={ESTIMATE_STATUS_TONE[estimate.status]} size="sm">
                        {ESTIMATE_STATUS_LABEL[estimate.status]}
                      </Badge>
                    </Inline>
                    <Text weight="semibold">{money(estimate.total)}</Text>
                  </Inline>
                </li>
              ))}
            </Stack>
          )
        }
      </QueryView>
      <Dialog open={creating} onOpenChange={setCreating}>
        {creating && (
          <NewEstimateForm
            onDone={() => {
              setCreating(false);
            }}
          />
        )}
      </Dialog>
    </Stack>
  );
}

function NewEstimateForm({ onDone }: { onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const lists = usePriceLists(organization.id);
  const create = useCreateEstimate(organization.id, claim.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  // Blank: the organization's default list, as the API picks it.
  const [list, setList] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const defaultList = lists.data?.find((l) => l.is_default);

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setProblem("Name it: Mitigation, Rebuild, Contents…");
      return;
    }
    setProblem(undefined);
    setFailure(null);
    let created;
    try {
      created = await create.mutateAsync({
        title: trimmed,
        ...(list ? { price_list_id: list } : {}),
      });
    } catch (error) {
      setFailure(
        isApiError(error, "claim_locked") ? "The claim was closed or cancelled." : message(error),
      );
      return;
    }
    onDone();
    await navigate(
      inOrganization(organization.slug, `claims/${claim.number}/estimates/${created.id}`),
    );
  };

  return (
    <FormDialog
      title="New estimate"
      submitLabel="Start estimate"
      pending={create.isPending}
      failure={failure}
      onSubmit={save}
    >
      <FormField label="Title" required error={problem}>
        <Input
          value={title}
          maxLength={200}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
      </FormField>
      <FormField
        label="Price list"
        hint={defaultList ? `Leave as is for ${defaultList.name}, your default` : undefined}
      >
        <Select
          placeholder={defaultList ? `${defaultList.name} (default)` : "No price list"}
          options={(lists.data ?? []).map((l) => ({
            value: l.id,
            label: l.is_default ? `${l.name} (default)` : l.name,
          }))}
          value={list}
          onValueChange={setList}
        />
      </FormField>
      <Text as="p" size="sm" tone="muted">
        Tax, overhead and profit start at your organization&apos;s rates; change them in the
        estimate.
      </Text>
    </FormDialog>
  );
}

export function message(error: unknown): string {
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
