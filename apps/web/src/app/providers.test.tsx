import { useMe } from "@claimforge/api-client/react";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { readConfig } from "../config";
import { renderApp } from "../test/render";

function WhoAmI() {
  const me = useMe();
  if (me.isError) return <p>Error: {me.error.message}</p>;
  return <p>{me.data ? `Signed in as ${me.data.full_name}` : "Loading"}</p>;
}

const probe = [{ path: "/", Component: WhoAmI }];

describe("the app's providers", () => {
  test("give pages the API, the query cache and a session", async () => {
    await renderApp("/", { signedInAs: "morgan@example.com", routes: probe });

    expect(await screen.findByText("Signed in as Morgan Member")).toBeInTheDocument();
  });

  test("without a session the API answers 401", async () => {
    await renderApp("/", { routes: probe });

    expect(await screen.findByText(/^Error:/)).toHaveTextContent(/authentication required/i);
  });
});

describe("config", () => {
  test("defaults to the local API, not the mock", () => {
    expect(readConfig({})).toEqual({
      apiUrl: "http://localhost:8000",
      mockApi: false,
      production: false,
    });
  });

  test("reads the API address and mock switch from the environment", () => {
    expect(
      readConfig({
        VITE_API_URL: " https://api.claimforge.dev ",
        VITE_API_MOCK: "true",
        PROD: true,
      }),
    ).toEqual({ apiUrl: "https://api.claimforge.dev", mockApi: true, production: true });
    expect(readConfig({ VITE_API_MOCK: "1" }).mockApi).toBe(false); // only "true" turns it on
  });
});
