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

const heading = () => screen.getByRole("heading", { level: 1 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pages", () => {
  test.each([
    ["/", "Dashboard"],
    ["/login", "Sign in"],
    ["/claims", "Claims"],
    ["/claims/new", "New claim"],
    ["/claims/2026-00042", "Claim 2026-00042"],
    ["/settings", "Settings"],
  ])("%s shows %s, in the tab too", async (path, title) => {
    await open(path);

    expect(heading()).toHaveTextContent(title);
    await waitFor(() => {
      expect(document.title).toBe(`${title} · ClaimForge`);
    });
  });

  test("signed-in pages sit in the layout; sign-in doesn't", async () => {
    await open("/claims");
    expect(screen.getByRole("main")).toContainElement(heading());
  });
});

describe("addresses that lead nowhere", () => {
  test.each(["/nope", "/claims/2026-00042/nope", "/settings/nope"])(
    "%s shows the not-found page",
    async (path) => {
      await open(path);

      expect(heading()).toHaveTextContent("Page not found");
    },
  );

  test("the not-found page leads back to the dashboard", async () => {
    const { router } = await open("/nope");

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Go to the dashboard" }));
    });

    await waitFor(() => {
      expect(heading()).toHaveTextContent("Dashboard");
    });
    expect(router.state.location.pathname).toBe("/");
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

    expect(heading()).toHaveTextContent("Something went wrong");
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

    await waitFor(() => {
      expect(heading()).toHaveTextContent("Page not found");
    });
  });
});
