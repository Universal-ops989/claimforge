import { ThemeProvider } from "@claimforge/ui";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, data, RouterProvider, type RouteObject } from "react-router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { RootLayout } from "./app/root-layout";
import { RouteError } from "./app/route-error";
import { routes } from "./routes";

function open(path: string, table: RouteObject[] = routes) {
  const router = createMemoryRouter(table, { initialEntries: [path] });
  render(
    <ThemeProvider storageKey={null}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return router;
}

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
    open(path);

    expect(heading()).toHaveTextContent(title);
    await waitFor(() => {
      expect(document.title).toBe(`${title} · ClaimForge`);
    });
  });

  test("signed-in pages sit in the layout; sign-in doesn't", () => {
    open("/claims");
    expect(screen.getByRole("main")).toContainElement(heading());
  });
});

describe("addresses that lead nowhere", () => {
  test.each(["/nope", "/claims/2026-00042/nope", "/settings/nope"])(
    "%s shows the not-found page",
    (path) => {
      open(path);

      expect(heading()).toHaveTextContent("Page not found");
    },
  );

  test("the not-found page leads back to the dashboard", async () => {
    const router = open("/nope");

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

  test("a page that throws shows an error page, not a blank screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    open("/", throwing(new Error("The claims list broke")));

    expect(heading()).toHaveTextContent("Something went wrong");
    expect(screen.getByText("The claims list broke")).toBeInTheDocument(); // dev shows why
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  test("a 404 from a loader reads as not found", async () => {
    open("/", [
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
