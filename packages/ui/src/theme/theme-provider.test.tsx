import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockMatchMedia } from "../test/match-media";
import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeSwitch() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <output>{`${theme}:${resolvedTheme}`}</output>
      <button
        type="button"
        onClick={() => {
          setTheme("dark");
        }}
      >
        Dark
      </button>
    </>
  );
}

describe("ThemeProvider", () => {
  let setSystemDark: (dark: boolean) => void;

  beforeEach(() => {
    setSystemDark = mockMatchMedia(false);
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the system preference by default and reacts to changes", () => {
    render(
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("system:light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    act(() => {
      setSystemDark(true);
    });

    expect(screen.getByRole("status")).toHaveTextContent("system:dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("applies and persists an explicit choice", async () => {
    render(
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("cf-theme")).toBe("dark");
  });

  it("restores a stored preference and ignores invalid values", () => {
    localStorage.setItem("cf-theme", "dark");
    const { unmount } = render(
      <ThemeProvider defaultTheme="light">
        <ThemeSwitch />
      </ThemeProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("dark:dark");
    unmount();

    localStorage.setItem("cf-theme", "sepia");
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeSwitch />
      </ThemeProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("light:light");
  });

  it("does not persist when storageKey is null", async () => {
    render(
      <ThemeProvider storageKey={null}>
        <ThemeSwitch />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(localStorage.length).toBe(0);
  });

  it("can scope the theme to a target element", () => {
    const target = document.createElement("div");
    render(
      <ThemeProvider defaultTheme="dark" target={target}>
        <ThemeSwitch />
      </ThemeProvider>,
    );

    expect(target).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});

describe("useTheme", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws a helpful error outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useTheme())).toThrow(/within a <ThemeProvider>/);
  });

  it("exposes the context inside a provider", () => {
    mockMatchMedia(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider defaultTheme="light" storageKey={null}>
        {children}
      </ThemeProvider>
    );
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.resolvedTheme).toBe("light");
  });
});
