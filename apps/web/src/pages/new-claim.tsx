import { isApiError } from "@claimforge/api-client";
import { useCreateClaim } from "@claimforge/api-client/react";
import { Button, Card, CardBody, Heading, Inline, Stack, Stepper, Text } from "@claimforge/ui";
import { FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { inOrganization, useOrganization } from "../app/organization";
import { Page } from "../app/page";
import { errorCopy } from "../app/states";
import {
  draftProblems,
  draftResolver,
  EMPTY_DRAFT,
  fieldFor,
  localToday,
  toClaimCreate,
  type ClaimDraft,
  type DraftField,
} from "../claims/new/draft";
import { LossStep, PropertyStep, STEP_FIELDS } from "../claims/new/steps";
import { LOSS_TYPE_LABEL } from "../claims/status";

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
  const form = useForm<ClaimDraft>({
    defaultValues: EMPTY_DRAFT,
    resolver: draftResolver,
    mode: "onTouched",
  });
  const navigate = useNavigate();
  const createClaim = useCreateClaim(organization.id);

  const asked = STEPS.find((step) => step.id === params.get("step"))?.id ?? "property";
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
  const address = [
    [property.line1, property.line2].filter(Boolean).join(", "),
    [property.city, [property.region, property.postal_code].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
  ].join("\n");
  const rows: [string, string][] = [
    ["Address", address],
    ["Year built", property.year_built || "Not given"],
    ["Cause of loss", loss.loss_type ? LOSS_TYPE_LABEL[loss.loss_type] : ""],
    ["Date of loss", loss.loss_date || "Not given"],
    ["What happened", loss.description || "Not given"],
    ["Carrier", loss.carrier_name || "Not given"],
    ["Policy number", loss.policy_number || "Not given"],
  ];
  return (
    <Stack gap={4}>
      <dl
        aria-label="Claim summary"
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "var(--cf-space-2) var(--cf-space-6)",
          margin: 0,
        }}
      >
        {rows.map(([term, value]) => (
          <div key={term} style={{ display: "contents" }}>
            <Text as="dt" tone="muted">
              {term}
            </Text>
            <Text as="dd" style={{ margin: 0, whiteSpace: "pre-line" }}>
              {value}
            </Text>
          </div>
        ))}
      </dl>
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

/**
 * The fields an API refusal is about: a 422's `errors[]`, read back into the form, and
 * the business rules about one field. Empty when the refusal isn't about a field.
 */
function refusedFields(error: unknown): { field: DraftField; message: string }[] {
  if (!isApiError(error)) return [];
  if (error.code === "loss_date_in_future") {
    return [{ field: "loss.loss_date", message: "The date of loss can't be in the future." }];
  }
  return error.fieldErrors.flatMap(({ loc, message }) => {
    const field = fieldFor(loc);
    return field ? [{ field, message }] : [];
  });
}
