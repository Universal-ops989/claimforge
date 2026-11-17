/**
 * Settings read from the environment at build time (Vite's `import.meta.env`):
 *
 * - `VITE_API_URL`: the API's origin; `http://localhost:8000` (where `just api` serves) by
 *   default.
 * - `VITE_API_MOCK=true`: run against the in-memory mock backend instead, in the browser.
 */
export interface AppConfig {
  apiUrl: string;
  mockApi: boolean;
  /** Production builds report contract mismatches instead of failing on them. */
  production: boolean;
}

export function readConfig(env: Partial<ImportMetaEnv> = import.meta.env): AppConfig {
  return {
    apiUrl: (env.VITE_API_URL ?? "").trim() || "http://localhost:8000",
    mockApi: env.VITE_API_MOCK === "true",
    production: env.PROD === true,
  };
}

export const config = readConfig();
