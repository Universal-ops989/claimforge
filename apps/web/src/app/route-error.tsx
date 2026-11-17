import { Button, EmptyState, Stack } from "@claimforge/ui";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { PageTitle } from "./page-title";

/**
 * What a route shows when it, or anything under it, throws: a 404 from the router reads as
 * "not found"; anything else as a failure the user can retry, with the details in dev.
 */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />;
  }
  console.error(error);
  return (
    <Stack as="main" align="center" justify="center" style={{ minHeight: "100dvh" }}>
      <PageTitle title="Something went wrong" />
      <EmptyState
        headingLevel={1}
        title="Something went wrong"
        description={
          import.meta.env.DEV && error instanceof Error
            ? error.message
            : "The page couldn't be shown. Try again, or go back to the dashboard."
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
