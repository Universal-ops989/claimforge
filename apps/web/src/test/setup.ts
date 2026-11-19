import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { backend, server } from "./render";

// Pages load their code on first visit (lazy routes), then their data: with every package's
// tests running at once, that can take more than the default second to appear.
configure({ asyncUtilTimeout: 3000 });

// jsdom lacks these; the design system's Radix primitives call them.
if (!("hasPointerCapture" in Element.prototype)) {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
}
if (!("ResizeObserver" in globalThis)) {
  // Radix measures some controls (the checkbox's hidden input) as they resize.
  globalThis.ResizeObserver = class {
    observe() {
      /* nothing resizes in jsdom */
    }
    unobserve() {
      /* nothing to stop */
    }
    disconnect() {
      /* nothing to stop */
    }
  };
}
if (!("scrollIntoView" in Element.prototype)) {
  Object.assign(Element.prototype, { scrollIntoView: () => undefined });
}
// jsdom has the property but leaves it undefined.
if (typeof window.matchMedia !== "function") {
  Object.assign(window, {
    matchMedia: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// Every test talks to the mock backend; anything else it fetches is a mistake.
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  backend.reset();
  // Nothing a test keeps in the browser leaks into the next one.
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => {
  server.close();
});
