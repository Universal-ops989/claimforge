import { createContext, use, type ReactNode } from "react";

import type { ApiClient } from "../client";

const ApiContext = createContext<ApiClient | null>(null);

export interface ApiProviderProps {
  client: ApiClient;
  children?: ReactNode;
}

/** Hands an `ApiClient` to every hook below it. Put it inside `QueryClientProvider`. */
export function ApiProvider({ client, children }: ApiProviderProps) {
  return <ApiContext value={client}>{children}</ApiContext>;
}

/** The client from the nearest `ApiProvider`. */
export function useApi(): ApiClient {
  const client = use(ApiContext);
  if (client === null) {
    throw new Error("useApi() needs an <ApiProvider> above it");
  }
  return client;
}
