import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement these browser APIs; Radix primitives rely on them.
if (!("hasPointerCapture" in Element.prototype)) {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
}
if (!("scrollIntoView" in Element.prototype)) {
  Object.assign(Element.prototype, { scrollIntoView: () => undefined });
}
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {
      /* noop */
    }
    unobserve() {
      /* noop */
    }
    disconnect() {
      /* noop */
    }
  };
}

afterEach(() => {
  cleanup();
});
