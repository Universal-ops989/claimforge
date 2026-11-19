import { isApiError } from "@claimforge/api-client";
import { useClaimByNumber } from "@claimforge/api-client/react";
import {
  Badge,
  Breadcrumbs,
  Button,
  EmptyState,
  Inline,
  SkeletonText,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from "@claimforge/ui";
import { Link, Outlet, useNavigate, useParams } from "react-router";

import { inOrganization, useOrganization } from "../app/organization";
import { Page } from "../app/page";
import { PageTitle } from "../app/page-title";
import { QueryView } from "../app/states";
import { StatusControl } from "../claims/detail/status-control";
import { CLAIM_TABS, useCurrentClaimTab, type Claim } from "../claims/detail/tabs";
import { LOSS_TYPE_LABEL, STATUS_LABEL, STATUS_TONE } from "../claims/status";

/**
 * One claim, by its number: `/claims/2026-00042`, with its tabs under it
 * (`/claims/2026-00042/timeline`). The claim loads here, once, for every tab.
 */
export function ClaimPage() {
  const { number = "" } = useParams();
  const organization = useOrganization();
  const claim = useClaimByNumber(organization.id, number);

  if (isApiError(claim.error) && claim.error.status === 404) {
    return <ClaimNotFound number={number} />;
  }
  return (
    <Page
      title={`Claim ${number}`}
      trail={
        <Breadcrumbs
          items={[
            { label: "Claims", href: inOrganization(organization.slug, "claims") },
            { label: number },
          ]}
          renderLink={(item, className) => (
            <Link to={item.href} className={className}>
              {item.label}
            </Link>
          )}
        />
      }
    >
      <QueryView query={claim} loading={<SkeletonText lines={3} />}>
        {(data) => <ClaimFrame claim={data} />}
      </QueryView>
    </Page>
  );
}

function ClaimFrame({ claim }: { claim: Claim }) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const current = useCurrentClaimTab();
  const claimPath = inOrganization(organization.slug, `claims/${claim.number}`);
  const adjuster = claim.assignments.find((assignment) => assignment.role === "adjuster");

  return (
    <>
      <Inline gap={3} align="center">
        <Badge tone={STATUS_TONE[claim.status]}>{STATUS_LABEL[claim.status]}</Badge>
        <Text tone="muted">
          {[
            `${LOSS_TYPE_LABEL[claim.loss_type]} loss`,
            claim.property.address.formatted,
            adjuster ? `Adjuster: ${adjuster.user.full_name}` : "No adjuster yet",
          ].join(" · ")}
        </Text>
        <StatusControl claim={claim} />
      </Inline>
      <Tabs
        value={current}
        onValueChange={(id) => {
          const tab = CLAIM_TABS.find((candidate) => candidate.id === id);
          if (tab) void navigate(tab.path ? `${claimPath}/${tab.path}` : claimPath);
        }}
      >
        <TabsList aria-label={`Claim ${claim.number}`}>
          {CLAIM_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={current}>
          <Outlet context={claim} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/** A number this organization has no claim under: a mistyped or stale link. */
function ClaimNotFound({ number }: { number: string }) {
  const organization = useOrganization();
  return (
    <>
      <PageTitle title="Claim not found" />
      <EmptyState
        headingLevel={1}
        title="Claim not found"
        description={`${organization.name} has no claim ${number}. The link may be mistyped, or the claim belongs to another organization.`}
        actions={
          <Button variant="primary" asChild>
            <Link to={inOrganization(organization.slug, "claims")}>Go to claims</Link>
          </Button>
        }
      />
    </>
  );
}
