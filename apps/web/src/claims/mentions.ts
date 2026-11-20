/**
 * Mentions in notes. The API takes `<@user-id>` tokens; people read and type `@Full Name`.
 * A note is written with names and sent with tokens, so these convert between the two.
 */

export interface Person {
  id: string;
  full_name: string;
}

const TOKEN = /<@([0-9a-f-]{36})>/g;

/** A note's body as people read it: each `<@id>` as `@Full Name` (from its `mentions`). */
export function toDisplay(body: string, mentions: readonly Person[]): string {
  return body.replace(TOKEN, (token, id: string) => {
    const person = mentions.find((p) => p.id === id);
    return person ? `@${person.full_name}` : token;
  });
}

/**
 * A note as typed, for the API: each `@Full Name` of a member becomes `<@id>`. Longer names
 * are matched first, so "@Sam Lee Jr" isn't read as "@Sam Lee".
 */
export function toBody(text: string, members: readonly Person[]): string {
  const byLength = [...members].sort((a, b) => b.full_name.length - a.full_name.length);
  let body = text;
  for (const member of byLength) {
    body = body.split(`@${member.full_name}`).join(`<@${member.id}>`);
  }
  return body;
}

/**
 * The name being typed after an `@`, when the caret is in a mention: what comes after the
 * last `@` that starts a word, up to the caret. `null` when not mentioning.
 */
export function mentionQuery(beforeCaret: string): string | null {
  const match = /(?:^|\s)@([\p{L}' -]{0,30})$/u.exec(beforeCaret);
  return match ? (match[1] ?? "") : null;
}

/** Members whose name matches what's typed: at the start of any word, ignoring case. */
export function suggest(query: string, members: readonly Person[], limit = 5): Person[] {
  const q = query.trim().toLowerCase();
  return members
    .filter(
      (m) =>
        q === "" ||
        m.full_name
          .toLowerCase()
          .split(/\s+/)
          .some((word, i, words) => words.slice(i).join(" ").startsWith(q)),
    )
    .slice(0, limit);
}

/**
 * `text` with the mention being typed before `caret` completed as `@Full Name `, and where
 * the caret goes after it.
 */
export function completeMention(
  text: string,
  caret: number,
  person: Person,
): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  // A space after the name, unless one follows already.
  const after = text.slice(caret);
  const inserted = /^\s/.test(after) ? `@${person.full_name}` : `@${person.full_name} `;
  return {
    text: text.slice(0, at) + inserted + after,
    caret: at + inserted.length,
  };
}

/** A note's text in pieces, with mentions of `people` marked, for showing them apart. */
export function segments(
  text: string,
  people: readonly Person[],
): { text: string; mention: boolean; start: number }[] {
  const names = [...people]
    .map((p) => `@${p.full_name}`)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (names.length === 0) return text ? [{ text, mention: false, start: 0 }] : [];
  let start = 0;
  return text
    .split(new RegExp(`(${names.join("|")})`))
    .filter(Boolean)
    .map((part) => {
      const piece = {
        text: part,
        mention: names.some((n) => new RegExp(`^${n}$`).test(part)),
        start,
      };
      start += part.length;
      return piece;
    });
}
