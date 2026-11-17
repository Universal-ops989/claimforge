import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { API_URL, renderApp, server } from "../test/render";

const PASSWORD = "correct horse battery staple";
const mock = mockApi(API_URL);

async function signIn(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText(/^Email/), email);
  if (password) await user.type(screen.getByLabelText(/^Password/), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("signing in", () => {
  test("goes where the user was headed", async () => {
    const { router } = await renderApp("/login?next=%2Fclaims%2F2026-00042");

    await signIn("morgan@example.com", PASSWORD);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/claims/2026-00042");
    });
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Claim 2026-00042");
  });

  test("goes to the dashboard when next would leave the app", async () => {
    const { router } = await renderApp("/login?next=https%3A%2F%2Fevil.test%2F");

    await signIn("morgan@example.com", PASSWORD);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });

  test("the email field is ready to type into, and password managers can fill both", async () => {
    await renderApp("/login");

    const email = screen.getByLabelText(/^Email/);
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("autocomplete", "current-password");
  });
});

describe("when it doesn't work", () => {
  test("a wrong password says so, and stays on the page", async () => {
    const { router } = await renderApp("/login");

    await signIn("morgan@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password don't match an account",
    );
    expect(router.state.location.pathname).toBe("/login");
  });

  test("empty fields are pointed out without asking the API", async () => {
    let asked = false;
    server.use(
      mock.post("/v1/auth/login", () => {
        asked = true;
        return problem(401, "invalid_credentials");
      }),
    );
    await renderApp("/login");

    await signIn("", "");

    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(asked).toBe(false);
  });

  test("too many attempts asks the user to wait", async () => {
    server.use(mock.post("/v1/auth/login", () => problem(429, "rate_limited")));
    await renderApp("/login");

    await signIn("morgan@example.com", PASSWORD);

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many sign-in attempts");
  });

  test("no connection says so", async () => {
    server.use(http.post(`${API_URL}/v1/auth/login`, () => HttpResponse.error()));
    await renderApp("/login");

    await signIn("morgan@example.com", PASSWORD);

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach ClaimForge");
  });

  test("the API's field errors land on their fields", async () => {
    server.use(
      mock.post("/v1/auth/login", () =>
        problem(422, "validation_failed", {
          errors: [
            { loc: ["body", "email"], message: "Not a valid email address.", type: "value_error" },
          ],
        }),
      ),
    );
    await renderApp("/login");

    await signIn("morgan@", PASSWORD);

    expect(await screen.findByText("Not a valid email address.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
