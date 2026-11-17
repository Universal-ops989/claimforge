import { ApiError, NetworkError } from "@claimforge/api-client";
import { Button, EmptyState, Stack } from "@claimforge/ui";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { PageTitle } from "./page-title";
import { errorCopy } from "./states";

/**
 * What a route shows when it, or anything under it, throws: a 404 (from the router or the
 * API) reads as "not found"; anything else is told in the words `errorCopy` uses, with a
 * retry, and a bug's own message in development.
 */
export function RouteError() {
  const error = useRouteError();
  if (
    (isRouteErrorResponse(error) && error.status === 404) ||
    (error instanceof ApiError && error.status === 404)
  ) {
    return <NotFound />;
  }
  console.error(error);
  const copy = errorCopy(error);
  // A bug (not an API or connection failure) shows its message in development.
  const bug = !(error instanceof ApiError) && !(error instanceof NetworkError);
  return (
    <Stack as="main" align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <PageTitle title={copy.title} />
      <EmptyState
        headingLevel={1}
        title={copy.title}
        description={
          import.meta.env.DEV && bug && error instanceof Error ? error.message : copy.description
        }
        actions={
          <>
            <Button
              variant="primary"
              onClick={() => {
                window.location.reload();
              }}
            >
              Try again
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/">Go to the dashboard</Link>
            </Button>
          </>
        }
      />
    </Stack>
  );
}

/** The page for a path no route matches. */
export function NotFound() {
  return (
    <Stack as="main" align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <PageTitle title="Page not found" />
      <EmptyState
        headingLevel={1}
        title="Page not found"
        description="This address doesn't lead anywhere. It may have been mistyped, or the page moved."
        actions={
          <Button variant="primary" asChild>
            <Link to="/">Go to the dashboard</Link>
          </Button>
        }
      />
    </Stack>
  );
}
