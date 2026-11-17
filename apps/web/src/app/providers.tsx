import type { ApiClient } from "@claimforge/api-client";
import { ApiProvider } from "@claimforge/api-client/react";
import { ThemeProvider } from "@claimforge/ui";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export interface ProvidersProps {
  api: ApiClient;
  queryClient: QueryClient;
  /** Where the theme preference is kept; `null` (tests) keeps it nowhere. */
  themeStorageKey?: string | null;
  children: ReactNode;
}

/** Everything a page can rely on: the theme, the query cache and the API client. */
export function Providers({ api, queryClient, themeStorageKey, children }: ProvidersProps) {
  return (
    <ThemeProvider {...(themeStorageKey === undefined ? {} : { storageKey: themeStorageKey })}>
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>{children}</ApiProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
