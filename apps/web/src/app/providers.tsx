import type { ApiClient } from "@claimforge/api-client";
import { ApiProvider } from "@claimforge/api-client/react";
import { ThemeProvider } from "@claimforge/ui";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { SessionProvider } from "../auth/session";
import type { SessionStore } from "../auth/session-store";

export interface ProvidersProps {
  api: ApiClient;
  queryClient: QueryClient;
  session: SessionStore;
  /** Where the theme preference is kept; `null` (tests) keeps it nowhere. */
  themeStorageKey?: string | null;
  children: ReactNode;
}

/** Everything a page can rely on: the theme, the query cache, the API client, the session. */
export function Providers({
  api,
  queryClient,
  session,
  themeStorageKey,
  children,
}: ProvidersProps) {
  return (
    <ThemeProvider {...(themeStorageKey === undefined ? {} : { storageKey: themeStorageKey })}>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>
          <SessionProvider store={session}>{children}</SessionProvider>
        </ApiProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
