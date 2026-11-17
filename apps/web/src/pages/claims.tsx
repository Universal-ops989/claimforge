import { allItems, useClaims } from "@claimforge/api-client/react";
import { Button, DataTable, EmptyState } from "@claimforge/ui";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";

import { inOrganization, useOrganization } from "../app/organization";
import { Page } from "../app/page";
import { ErrorPanel } from "../app/states";
import { claimColumns, type ClaimRow } from "../claims/columns";

/** The organization's claims, newest first. */
export function ClaimsPage() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const claims = useClaims(organization.id);
  const claimPath = (number: string) => inOrganization(organization.slug, `claims/${number}`);
  const newClaimPath = inOrganization(organization.slug, "claims/new");
  const { slug } = organization;
  // "Updated 3 hours ago" counts from when the list arrived.
  const columns = useMemo(
    () =>
      claimColumns(
        (number) => inOrganization(slug, `claims/${number}`),
        new Date(claims.dataUpdatedAt),
      ),
    [slug, claims.dataUpdatedAt],
  );

  const newClaim = (
    <Button variant="primary" leadingIcon={<Plus aria-hidden="true" />} asChild>
      <Link to={newClaimPath}>New claim</Link>
    </Button>
  );

  return (
    <Page title="Claims" actions={newClaim}>
      {claims.isError ? (
        <ErrorPanel
          error={claims.error}
          onRetry={() => {
            void claims.refetch();
          }}
        />
      ) : (
        <DataTable<ClaimRow>
          caption="Claims"
          data={allItems(claims.data)}
          columns={columns}
          getRowId={(claim) => claim.id}
          getRowLabel={(claim) => `Claim ${claim.number}`}
          loading={claims.isPending}
          onRowClick={(claim) => {
            void navigate(claimPath(claim.number));
          }}
          emptyState={
            <EmptyState
              headingLevel={2}
              title="No claims yet"
              description="Claims you open, or are assigned, show up here."
              actions={newClaim}
            />
          }
        />
      )}
    </Page>
  );
}
