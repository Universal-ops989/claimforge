import { useCreateClaim } from "@claimforge/api-client/react";
import {
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  Heading,
  Inline,
  Stack,
  Stepper,
  Text,
} from "@claimforge/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { Link, Navigate, useBlocker, useNavigate, useSearchParams } from "react-router";

import { Facts } from "../app/facts";
import { inOrganization, useOrganization } from "../app/organization";
import { Page } from "../app/page";
import { errorCopy } from "../app/states";
import {
  draftProblems,
  draftResolver,
  EMPTY_DRAFT,
  localToday,
  refusedFields,
  toClaimCreate,
  type ClaimDraft,
} from "../claims/new/draft";
import { createDraftStore, hasContent } from "../claims/new/draft-store";
import { LossStep, PropertyStep, STEP_FIELDS } from "../claims/new/steps";
import { LOSS_TYPE_LABEL } from "../claims/status";
import { addressLines } from "../format/address";
import { calendarDate } from "../format/calendar-date";

const STEPS = [
  { id: "property", label: "Property", description: "Where the damage is" },
  { id: "loss", label: "Loss", description: "What happened" },
  { id: "review", label: "Review", description: "Check and create" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const indexOf = (id: StepId) => STEPS.findIndex((step) => step.id === id);

/** The first step with a problem in `draft`, if any before `upto`. */
function firstUnfinished(draft: ClaimDraft, upto: StepId): StepId | null {
  const now = new Date();
  const problems = draftProblems(draft, localToday(now), now.getFullYear());
  for (const step of ["property", "loss"] as const) {
    if (indexOf(step) >= indexOf(upto)) return null;
    if (STEP_FIELDS[step].some((field) => field in problems)) return step;
  }
  return null;
}

/** `/:org/claims/new`: a claim in three steps, the step in the address. */
export function NewClaimPage() {
  const organization = useOrganization();
  const [params, setParams] = useSearchParams();
  const store = useMemo(
    () => createDraftStore(sessionStorageOrNull(), organization.id),
    [organization.id],
  );
  // What was typed before a reload, or before a trip elsewhere in the app.
  const [saved] = useState(() => store.read());
  const form = useForm<ClaimDraft>({
    defaultValues: saved?.draft ?? EMPTY_DRAFT,
    resolver: draftResolver,
    mode: "onTouched",
  });
  const navigate = useNavigate();
  const createClaim = useCreateClaim(organization.id);
  /** Set once the draft has been created or discarded: leaving no longer asks. */
  const doneRef = useRef(false);

  const asked =
    STEPS.find((step) => step.id === params.get("step"))?.id ?? saved?.step ?? "property";

  // Keep the draft as it's typed, and the step it's on.
  useEffect(() => {
    store.save(form.getValues(), asked);
    return form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        if (!doneRef.current) store.save(values, asked);
      },
    });
  }, [form, store, asked]);

  // Leaving the form (not moving between its steps) with something typed asks first.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !doneRef.current &&
      currentLocation.pathname !== nextLocation.pathname &&
      hasContent(form.getValues()),
  );

  // A later step can't be reached by address before the earlier ones are done.
  const unfinished = firstUnfinished(form.getValues(), asked);
  if (unfinished) {
    return <Navigate to={`?step=${unfinished}`} replace />;
  }
  const current = indexOf(asked);

  const go = (step: StepId) => {
    setParams((now) => {
      const next = new URLSearchParams(now);
      next.set("step", step);
      return next;
    });
  };

  /** Create the claim and open it; refusals go back to the field they're about. */
  const create = async () => {
    let created;
    try {
      created = await createClaim.mutateAsync(toClaimCreate(form.getValues()));
    } catch (error) {
      const refused = refusedFields(error);
      const [first] = refused;
      for (const { field, message } of refused) {
        form.setError(field, { message });
      }
      if (first) {
        go(first.field.startsWith("property.") ? "property" : "loss");
      }
      return;
    }
    doneRef.current = true;
    store.clear();
    await navigate(inOrganization(organization.slug, `claims/${created.number}`));
  };

  const next = async () => {
    if (asked === "review") return;
    if (await form.trigger(STEP_FIELDS[asked], { shouldFocus: true })) {
      go(STEPS[current + 1]?.id ?? "review");
    }
  };

  return (
    <Page
      title="New claim"
      actions={
        <Button variant="ghost" asChild>
          <Link to={inOrganization(organization.slug, "claims")}>Cancel</Link>
        </Button>
      }
    >
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
        title="Discard this claim?"
        description="What you've typed for this claim will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          doneRef.current = true;
          store.clear();
          if (blocker.state === "blocked") blocker.proceed();
        }}
      />
      <Stepper
        label="New claim steps"
        steps={STEPS.map(({ id, label, description }) => ({ id, label, description }))}
        current={current}
        onStepClick={(index) => {
          const step = STEPS[index];
          // The stepper only offers steps already passed; later ones stay disabled.
          if (step) go(step.id);
        }}
      />
      <Card>
        <CardBody>
          <FormProvider {...form}>
            <form
              noValidate
              aria-labelledby="step-heading"
              onSubmit={(event) => {
                event.preventDefault();
                void next();
              }}
            >
              <Stack gap={6}>
                <Heading level={2} id="step-heading">
                  {STEPS[current]?.label}
                </Heading>
                {asked === "property" && <PropertyStep />}
                {asked === "loss" && <LossStep />}
                {asked === "review" && <Review form={form} onEdit={go} />}
                {asked === "review" &&
                  createClaim.error &&
                  refusedFields(createClaim.error).length === 0 && (
                    <Text as="p" role="alert" tone="danger">
                      {`${errorCopy(createClaim.error).title}. ${errorCopy(createClaim.error).description}`}
                    </Text>
                  )}
                <Inline justify="between">
                  {current > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        go(STEPS[current - 1]?.id ?? "property");
                      }}
                    >
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  {asked !== "review" ? (
                    <Button type="submit" variant="primary">
                      Next
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      loading={createClaim.isPending}
                      onClick={() => {
                        void create();
                      }}
                    >
                      {createClaim.error ? "Try again" : "Create claim"}
                    </Button>
                  )}
                </Inline>
              </Stack>
            </form>
          </FormProvider>
        </CardBody>
      </Card>
    </Page>
  );
}

/** What was entered, to check before creating; each section can be gone back to. */
function Review({
  form,
  onEdit,
}: {
  form: UseFormReturn<ClaimDraft>;
  onEdit: (step: StepId) => void;
}) {
  const { property, loss } = form.getValues();
  return (
    <Stack gap={4}>
      <Facts
        label="Claim summary"
        facts={[
          ["Address", addressLines(property)],
          ["Year built", property.year_built],
          ["Cause of loss", loss.loss_type ? LOSS_TYPE_LABEL[loss.loss_type] : null],
          ["Date of loss", loss.loss_date ? calendarDate(loss.loss_date) : null],
          ["What happened", loss.description],
          ["Carrier", loss.carrier_name],
          ["Policy number", loss.policy_number],
        ]}
      />
      <Inline gap={3}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit("property");
          }}
        >
          Edit property
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit("loss");
          }}
        >
          Edit loss
        </Button>
      </Inline>
    </Stack>
  );
}

/** `sessionStorage`, unless the browser refuses it. */
function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
