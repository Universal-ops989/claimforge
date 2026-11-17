import { allItems, useClaims } from "@claimforge/api-client/react";
import { Button, DataTable, EmptyState } from "@claimforge/ui";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { inOrganization, useOrganization } from "../app/organization";
import { Page } from "../app/page";
import { ErrorPanel } from "../app/states";
import { claimColumns, type ClaimRow } from "../claims/columns";
import { FilterBar } from "../claims/filter-bar";
import {
  filtersQuery,
  hasFilters,
  NO_FILTERS,
  readFilters,
  writeFilters,
  type ClaimFilters,
} from "../claims/filters";

/** The organization's claims, newest first, filtered by what the address says. */
export function ClaimsPage() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const claims = useClaims(organization.id, filtersQuery(filters));
  const changeFilters = useCallback(
    (next: ClaimFilters) => {
      // Typing a search replaces the entry; picking a filter is a step Back can undo.
      const typing = next.q !== filters.q;
      setParams((current) => writeFilters(current, next), { replace: typing });
    },
    [filters.q, setParams],
  );
  const filtered = hasFilters(filters);
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
      <FilterBar filters={filters} onChange={changeFilters} />
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
            filtered ? (
              <EmptyState
                headingLevel={2}
                title="No claims match these filters"
                description="Try fewer filters, or a shorter search."
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      changeFilters(NO_FILTERS);
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                headingLevel={2}
                title="No claims yet"
                description="Claims you open, or are assigned, show up here."
                actions={newClaim}
              />
            )
          }
        />
      )}
    </Page>
  );
}
