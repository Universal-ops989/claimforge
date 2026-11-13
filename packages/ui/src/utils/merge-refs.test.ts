import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { mergeRefs } from "./merge-refs";

describe("mergeRefs", () => {
  it("assigns object refs and calls callback refs, then cleans both up", () => {
    const objectRef = createRef<string>();
    const callbackRef = vi.fn();

    const cleanup = mergeRefs(objectRef, callbackRef, undefined)("node");

    expect(objectRef.current).toBe("node");
    expect(callbackRef).toHaveBeenCalledWith("node");

    cleanup?.();
    expect(objectRef.current).toBeNull();
    expect(callbackRef).toHaveBeenLastCalledWith(null);
  });

  it("uses cleanup functions returned by callback refs", () => {
    const cleanupFn = vi.fn();
    const callbackRef = vi.fn(() => cleanupFn);

    mergeRefs(callbackRef)("node")?.();

    expect(cleanupFn).toHaveBeenCalledOnce();
    expect(callbackRef).toHaveBeenCalledTimes(1);
  });
});
