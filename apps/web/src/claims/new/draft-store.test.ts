import { describe, expect, test } from "vitest";

import { EMPTY_DRAFT, type ClaimDraft } from "./draft";
import { createDraftStore, hasContent, parseSavedDraft } from "./draft-store";

const typed: ClaimDraft = {
  ...EMPTY_DRAFT,
  property: { ...EMPTY_DRAFT.property, line1: "5 Elm St" },
};

describe("hasContent", () => {
  test("an untouched form has nothing worth keeping", () => {
    expect(hasContent(EMPTY_DRAFT)).toBe(false);
  });

  test("anything typed, or a choice changed, counts", () => {
    expect(hasContent(typed)).toBe(true);
    expect(
      hasContent({
        ...EMPTY_DRAFT,
        property: { ...EMPTY_DRAFT.property, property_type: "commercial" },
      }),
    ).toBe(true);
  });
});

describe("parseSavedDraft", () => {
  test("reads a saved draft and its step back", () => {
    expect(parseSavedDraft(JSON.stringify({ draft: typed, step: "loss" }))).toEqual({
      draft: typed,
      step: "loss",
    });
  });

  test.each([null, "{oops", "[]", '"draft"', '{"step":"loss"}'])("%j is no draft", (text) => {
    expect(parseSavedDraft(text)).toBeNull();
  });

  test("fills gaps from the empty draft and drops what doesn't belong", () => {
    const saved = parseSavedDraft(
      JSON.stringify({
        draft: {
          property: { line1: "5 Elm St", city: 7, extra: "x" },
          loss: { loss_type: "lava" },
        },
        step: "somewhere",
      }),
    );

    expect(saved).toEqual({
      draft: { property: { ...EMPTY_DRAFT.property, line1: "5 Elm St" }, loss: EMPTY_DRAFT.loss },
      step: "property",
    });
  });
});

describe("the draft store", () => {
  test("keeps a draft per organization, and forgets an empty one", () => {
    const store = createDraftStore(sessionStorage, "org-1");

    store.save(typed, "loss");
    const kept = store.read();
    const elsewhere = createDraftStore(sessionStorage, "org-2").read();
    store.save(EMPTY_DRAFT, "property");

    expect(kept?.step).toBe("loss");
    expect(elsewhere).toBeNull();
    expect(store.read()).toBeNull();
  });

  test("still works when the browser refuses storage", () => {
    const refusing = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    const store = createDraftStore(refusing, "org-1");

    expect(() => {
      store.save(typed, "property");
    }).not.toThrow();
    expect(store.read()).toBeNull();
  });
});
