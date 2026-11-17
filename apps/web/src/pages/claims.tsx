import { allItems, useClaims } from "@claimforge/api-client/react";
import { Button, DataTable, EmptyState, Inline, Select, Stack, Text } from "@claimforge/ui";
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
import { createViewStore, viewQuery } from "../claims/saved-views";
import { readSort, SORTS, writeSort, type ClaimSort } from "../claims/sort";
import { ViewsMenu } from "../claims/views-menu";

/** The organization's claims, filtered and sorted as the address says, a page at a time. */
export function ClaimsPage() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const sort = readSort(params);
  const claims = useClaims(organization.id, { ...filtersQuery(filters), sort });
  const loaded = allItems(claims.data);
  const changeFilters = useCallback(
    (next: ClaimFilters) => {
      // Typing a search replaces the entry; picking a filter is a step Back can undo.
      const typing = next.q !== filters.q;
      setParams((current) => writeFilters(current, next), { replace: typing });
    },
    [filters.q, setParams],
  );
  const filtered = hasFilters(filters);
  const views = useMemo(
    () => createViewStore(browserStorage(), organization.id),
    [organization.id],
  );
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
      <Inline justify="between" align="center" gap={3}>
        <FilterBar filters={filters} onChange={changeFilters} />
        <Inline gap={3} align="center">
          <ViewsMenu
            key={organization.id}
            store={views}
            current={viewQuery(params)}
            onOpen={(query) => {
              setParams(new URLSearchParams(query));
            }}
          />
          <Select
            aria-label="Sort claims"
            size="sm"
            options={SORTS}
            value={sort}
            onValueChange={(value) => {
              setParams((current) => writeSort(current, value as ClaimSort));
            }}
          />
        </Inline>
      </Inline>
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
          data={loaded}
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
      {claims.isSuccess && loaded.length > 0 && (
        <Stack gap={2} align="center">
          <Text size="sm" tone="muted" role="status">
            {claims.hasNextPage
              ? `Showing ${String(loaded.length)} claims`
              : `Showing all ${String(loaded.length)} ${loaded.length === 1 ? "claim" : "claims"}`}
          </Text>
          {claims.hasNextPage && (
            <Button
              variant="secondary"
              loading={claims.isFetchingNextPage}
              onClick={() => {
                void claims.fetchNextPage();
              }}
            >
              Load more claims
            </Button>
          )}
        </Stack>
      )}
    </Page>
  );
}

/** `localStorage`, unless the browser refuses it. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
