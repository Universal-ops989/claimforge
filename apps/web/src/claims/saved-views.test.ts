import { afterEach, describe, expect, test } from "vitest";

import { createViewStore, viewQuery } from "./saved-views";

const ORG = "org-1";

afterEach(() => {
  localStorage.clear();
});

describe("viewQuery", () => {
  test("writes filters and sort the same way however the address was typed", () => {
    expect(viewQuery(new URLSearchParams("sort=created_at&loss_type=water&status=on_hold"))).toBe(
      "status=on_hold&loss_type=water&sort=created_at",
    );
  });

  test("keeps only what a view is: no defaults, no unknown values, nothing else", () => {
    expect(viewQuery(new URLSearchParams("sort=-created_at&status=bogus&tab=photos"))).toBe("");
  });
});

describe("the view store", () => {
  test("saves, lists and deletes", () => {
    const store = createViewStore(localStorage, ORG);

    const saved = store.save("  Water on hold ", "status=on_hold&loss_type=water");
    const listed = store.list();
    if (saved.ok) store.remove(saved.view.id);

    expect(saved).toMatchObject({ ok: true, view: { name: "Water on hold" } });
    expect(listed.map((view) => view.name)).toEqual(["Water on hold"]);
    expect(store.list()).toEqual([]);
  });

  test("keeps views across visits", () => {
    createViewStore(localStorage, ORG).save("Mine", "q=elm");

    expect(
      createViewStore(localStorage, ORG)
        .list()
        .map((view) => view.query),
    ).toEqual(["q=elm"]);
  });

  test.each([
    ["   ", "Give the view a name."],
    ["x".repeat(61), "Keep the name to 60 characters or fewer."],
    ["water ON HOLD", 'There\'s already a view called "water ON HOLD".'],
  ])("refuses the name %j", (name, error) => {
    const store = createViewStore(localStorage, ORG);
    store.save("Water on hold", "status=on_hold");

    expect(store.save(name, "q=x")).toEqual({ ok: false, error });
  });

  test("each organization has its own views", () => {
    createViewStore(localStorage, ORG).save("Ours", "q=a");

    expect(createViewStore(localStorage, "org-2").list()).toEqual([]);
  });

  test("ignores what isn't a list of views", () => {
    localStorage.setItem(
      `claimforge.claim-views.${ORG}`,
      '[{"name": 1}, "x", {"id":"a","name":"Ok","query":"q=1"}]',
    );

    expect(
      createViewStore(localStorage, ORG)
        .list()
        .map((view) => view.name),
    ).toEqual(["Ok"]);
  });

  test("says so when the browser refuses storage", () => {
    const refusing = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    const store = createViewStore(refusing, ORG);

    expect(store.available).toBe(false);
    expect(store.save("Mine", "q=elm")).toEqual({
      ok: false,
      error: "This browser won't keep saved views.",
    });
  });
});
