/**
 * The states every page with data shares, worded the same everywhere: loading, failed
 * (and why), offline.
 */
import { ApiError, NetworkError } from "@claimforge/api-client";
import { Button, EmptyState, SkeletonText, Text } from "@claimforge/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";

export interface ErrorCopy {
  title: string;
  description: string;
  /** Whether trying again might help. */
  retry: boolean;
  /** The API's id for the failed request, for a support ticket. */
  requestId?: string;
}

/** What to tell someone about `error`. */
export function errorCopy(error: unknown): ErrorCopy {
  if (error instanceof NetworkError) {
    return {
      title: "Can't reach ClaimForge",
      description: "Check your connection. Nothing you've saved is lost.",
      retry: true,
    };
  }
  if (error instanceof ApiError) {
    const requestId = error.problem.request_id ?? undefined;
    if (error.status === 404) {
      return {
        title: "Not found",
        description: "It may have been deleted, or the link is wrong.",
        retry: false,
      };
    }
    if (error.status === 403) {
      return {
        title: "You don't have access",
        description: "Ask someone who manages your organization if you need it.",
        retry: false,
      };
    }
    return {
      title: "Something went wrong",
      description: "ClaimForge couldn't load this. Try again in a moment.",
      retry: true,
      ...(requestId ? { requestId } : {}),
    };
  }
  return {
    title: "Something went wrong",
    description: "This couldn't be shown. Try again in a moment.",
    retry: true,
  };
}

export interface ErrorPanelProps {
  error: unknown;
  /** Shown as "Try again" when trying again might help. */
  onRetry?: () => void;
  headingLevel?: 1 | 2 | 3;
}

/** Why something failed, and what to do about it. */
export function ErrorPanel({ error, onRetry, headingLevel = 2 }: ErrorPanelProps) {
  const copy = errorCopy(error);
  return (
    <EmptyState
      headingLevel={headingLevel}
      title={copy.title}
      description={
        <>
          {copy.description}
          {copy.requestId && (
            <Text as="small" tone="subtle" style={{ display: "block" }}>
              Request {copy.requestId}
            </Text>
          )}
        </>
      }
      actions={
        copy.retry && onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export interface QueryViewProps<Data> {
  query: Pick<UseQueryResult<Data>, "data" | "error" | "isPending" | "isError" | "refetch">;
  /** What to show while loading; a few skeleton lines by default. */
  loading?: ReactNode;
  children: (data: Data) => ReactNode;
}

/** A query's data once it's there; until then a skeleton, and on failure the reason. */
export function QueryView<Data>({ query, loading, children }: QueryViewProps<Data>) {
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {loading ?? <SkeletonText lines={4} />}
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorPanel
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  return children(query.data as Data);
}

const subscribeToConnection = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/** Whether the browser thinks it's online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
}

/** A bar saying the connection is gone, shown only while it is. */
export function OfflineBar() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: "var(--cf-space-2)",
        alignItems: "center",
        padding: "var(--cf-space-2) var(--cf-space-4)",
        marginBottom: "var(--cf-space-4)",
        borderRadius: "var(--cf-radius-md)",
        background: "var(--cf-color-warning-subtle)",
        color: "var(--cf-color-warning-text)",
      }}
    >
      <WifiOff aria-hidden="true" size={16} />
      <Text as="span" tone="inherit">
        You're offline. Changes can't be saved until the connection is back.
      </Text>
    </div>
  );
}
