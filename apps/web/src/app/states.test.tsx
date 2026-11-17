import { ApiError, NetworkError } from "@claimforge/api-client";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { useMe } from "@claimforge/api-client/react";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { API_URL, renderApp, server } from "../test/render";
import { RootLayout } from "./root-layout";
import { RouteError } from "./route-error";
import { errorCopy, QueryView } from "./states";

const mock = mockApi(API_URL);
const apiError = (status: number, code: string, requestId: string | null = null) =>
  new ApiError({
    type: `https://claimforge.dev/problems/${code}`,
    title: code,
    status,
    detail: code,
    instance: "/v1/me",
    code,
    request_id: requestId,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("errorCopy", () => {
  test.each([
    [
      new NetworkError("get", "https://api.test/v1/me", new TypeError("fetch failed")),
      "Can't reach ClaimForge",
      true,
    ],
    [apiError(404, "not_found"), "Not found", false],
    [apiError(403, "permission_denied"), "You don't have access", false],
    [apiError(500, "internal_error"), "Something went wrong", true],
    [new Error("a bug"), "Something went wrong", true],
  ])("%s reads as %s", (error, title, retry) => {
    expect(errorCopy(error)).toMatchObject({ title, retry });
  });

  test("a server failure carries the request id for a support ticket", () => {
    expect(errorCopy(apiError(500, "internal_error", "req-7f3a")).requestId).toBe("req-7f3a");
  });
});

describe("QueryView", () => {
  function Me() {
    const me = useMe();
    return <QueryView query={me}>{(data) => <p>Hello {data.full_name}</p>}</QueryView>;
  }
  const probe = [{ path: "/", Component: Me }];

  test("shows a skeleton while loading, then the data", async () => {
    await renderApp("/", { signedInAs: "morgan@example.com", routes: probe });

    expect(screen.getByLabelText("Loading")).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("Hello Morgan Member")).toBeInTheDocument();
  });

  test("says why it failed, and Try again asks again", async () => {
    server.use(mock.get("/v1/me", () => problem(500, "internal_error", { request_id: "req-1" })));
    await renderApp("/", { signedInAs: "morgan@example.com", routes: probe });

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Request req-1")).toBeInTheDocument();
    server.resetHandlers(); // the mock backend answers again
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Hello Morgan Member")).toBeInTheDocument();
  });

  test("offers no retry where it can't help", async () => {
    server.use(mock.get("/v1/me", () => problem(403, "permission_denied")));
    await renderApp("/", { signedInAs: "morgan@example.com", routes: probe });

    expect(await screen.findByText("You don't have access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});

describe("the offline bar", () => {
  test("appears while the browser is offline, and goes when it's back", async () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    await renderApp("/lone-star", { signedInAs: "morgan@example.com" });
    await screen.findByRole("heading", { level: 1, name: "Dashboard" });
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();

    online.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();

    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => {
      expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
    });
  });
});

describe("RouteError", () => {
  const throwing = (thrown: unknown) => [
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

  test("an API 404 reads as not found", async () => {
    await renderApp("/", {
      signedInAs: "morgan@example.com",
      routes: throwing(apiError(404, "not_found")),
    });

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  });

  test("a lost connection says so, not 'something went wrong'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const lost = new NetworkError("get", "https://api.test/v1/me", new TypeError("fetch failed"));

    await renderApp("/", { signedInAs: "morgan@example.com", routes: throwing(lost) });

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Can't reach ClaimForge",
    );
  });
});
