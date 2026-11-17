import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { data, type RouteObject } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { RootLayout } from "./app/root-layout";
import { RouteError } from "./app/route-error";
import { renderApp } from "./test/render";

/** Open `path` signed in as Morgan, except the sign-in page, which wants nobody signed in. */
const open = (path: string, routes?: RouteObject[]) =>
  renderApp(path, {
    ...(routes ? { routes } : {}),
    ...(path.startsWith("/login") ? {} : { signedInAs: "morgan@example.com" as const }),
  });

const heading = () => screen.findByRole("heading", { level: 1 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pages", () => {
  test.each([
    ["/lone-star", "Dashboard"],
    ["/login", "Sign in"],
    ["/lone-star/claims", "Claims"],
    ["/lone-star/claims/new", "New claim"],
    ["/lone-star/claims/2026-00042", "Claim 2026-00042"],
    ["/lone-star/settings", "Settings"],
  ])("%s shows %s, in the tab too", async (path, title) => {
    await open(path);

    expect(await heading()).toHaveTextContent(title);
    await waitFor(() => {
      expect(document.title).toBe(`${title} · ClaimForge`);
    });
  });

  test("signed-in pages sit in the layout; sign-in doesn't", async () => {
    await open("/lone-star/claims");
    const title = await heading();
    expect(screen.getByRole("main")).toContainElement(title);
  });
});

describe("addresses that lead nowhere", () => {
  test.each([
    "/nope",
    "/lone-star/claims/2026-00042/nope",
    "/lone-star/settings/nope",
    "/elsewhere/claims",
  ])("%s shows the not-found page", async (path) => {
    await open(path);

    expect(await heading()).toHaveTextContent("Page not found");
  });

  test("the not-found page leads back to the dashboard", async () => {
    const { router } = await open("/nope");

    const link = await screen.findByRole("link", { name: "Go to the dashboard" });
    act(() => {
      fireEvent.click(link);
    });

    await waitFor(async () => {
      expect(await heading()).toHaveTextContent("Dashboard");
    });
    expect(router.state.location.pathname).toBe("/lone-star");
  });
});

describe("errors", () => {
  const throwing = (thrown: unknown): RouteObject[] => [
    {
      path: "/",
      Component: RootLayout,
      ErrorBoundary: RouteError,
      children: [
        {
          index: true,
          Component: () => {
            throw thrown;
          },
        },
      ],
    },
  ];

  test("a page that throws shows an error page, not a blank screen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await open("/", throwing(new Error("The claims list broke")));

    expect(await heading()).toHaveTextContent("Something went wrong");
    expect(screen.getByText("The claims list broke")).toBeInTheDocument(); // dev shows why
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  test("a 404 from a loader reads as not found", async () => {
    await open("/", [
      {
        path: "/",
        Component: RootLayout,
        ErrorBoundary: RouteError,
        loader: () => {
          // React Router turns a thrown data() into an error response: its documented 404.
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw data("No such claim", { status: 404 });
        },
      },
    ]);

    await waitFor(async () => {
      expect(await heading()).toHaveTextContent("Page not found");
    });
  });
});
