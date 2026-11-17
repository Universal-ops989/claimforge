import { ThemeProvider } from "@claimforge/ui";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { App } from "./app";

test("renders the app inside the design system's theme", () => {
  render(
    <ThemeProvider storageKey={null}>
      <App />
    </ThemeProvider>,
  );

  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "ClaimForge" })).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute("data-theme");
});
