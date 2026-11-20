import { describe, expect, test } from "vitest";

import { completeMention, mentionQuery, segments, suggest, toBody, toDisplay } from "./mentions";

const riley = { id: "00000000-0000-4000-8000-000000000001", full_name: "Riley Tech" };
const sam = { id: "00000000-0000-4000-8000-000000000002", full_name: "Sam Lee" };
const samJr = { id: "00000000-0000-4000-8000-000000000003", full_name: "Sam Lee Jr" };

describe("tokens and names", () => {
  test("a body reads with names, and a typed note goes back with tokens", () => {
    const body = `Ask <@${riley.id}> about the fans.`;

    const shown = toDisplay(body, [riley]);

    expect(shown).toBe("Ask @Riley Tech about the fans.");
    expect(toBody(shown, [riley, sam])).toBe(body);
  });

  test("the longer of two similar names wins", () => {
    expect(toBody("@Sam Lee Jr and @Sam Lee", [sam, samJr])).toBe(
      `<@${samJr.id}> and <@${sam.id}>`,
    );
  });

  test("a token for someone not listed stays as it is", () => {
    expect(toDisplay(`<@${sam.id}>`, [])).toBe(`<@${sam.id}>`);
  });
});

describe("typing a mention", () => {
  test("starts at an @ that begins a word", () => {
    expect(mentionQuery("Ask @Ri")).toBe("Ri");
    expect(mentionQuery("@")).toBe("");
    expect(mentionQuery("Ask @Riley T")).toBe("Riley T");
    expect(mentionQuery("mail me at a@b")).toBeNull();
    expect(mentionQuery("Ask Riley")).toBeNull();
  });

  test("suggests members by the start of any word in their name", () => {
    expect(suggest("le", [riley, sam, samJr])).toEqual([sam, samJr]);
    expect(suggest("riley t", [riley, sam])).toEqual([riley]);
    expect(suggest("", [riley, sam], 1)).toEqual([riley]);
  });

  test("completing puts the full name in, and the caret after it", () => {
    expect(completeMention("Ask @Ri about it", 7, riley)).toEqual({
      text: "Ask @Riley Tech about it",
      caret: 15,
    });
    expect(completeMention("Ask @Ri", 7, riley)).toEqual({ text: "Ask @Riley Tech ", caret: 16 });
  });
});

test("segments mark the mentions in a note's text", () => {
  expect(segments("Ask @Riley Tech now", [riley])).toEqual([
    { text: "Ask ", mention: false, start: 0 },
    { text: "@Riley Tech", mention: true, start: 4 },
    { text: " now", mention: false, start: 15 },
  ]);
  expect(segments("No one", [])).toEqual([{ text: "No one", mention: false, start: 0 }]);
});
