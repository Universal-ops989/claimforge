import { vi } from "vitest";

type Listener = (event: MediaQueryListEvent) => void;

/**
 * Installs a controllable window.matchMedia (jsdom does not implement it).
 * Returns a setter that flips the dark-mode preference and notifies listeners.
 */
export function mockMatchMedia(initialDark = false) {
  let dark = initialDark;
  const listeners = new Set<Listener>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return query.includes("dark") ? dark : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: "change", listener: Listener) => listeners.add(listener),
      removeEventListener: (_type: "change", listener: Listener) => listeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

  return (nextDark: boolean) => {
    dark = nextDark;
    for (const listener of listeners) {
      listener({ matches: nextDark } as MediaQueryListEvent);
    }
  };
}
