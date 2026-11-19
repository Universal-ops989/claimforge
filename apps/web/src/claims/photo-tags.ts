/** Tags as typed ("Before, ceiling,  water line") as the API keeps them: lowercase, single
 * spaced, without repeats, alphabetical. */
export function parseTags(text: string): string[] {
  const tags = text
    .split(",")
    .map((tag) => tag.trim().split(/\s+/).join(" ").toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)].sort();
}

/** Tags as a line to edit: "before, ceiling". */
export function tagsText(tags: readonly string[]): string {
  return tags.join(", ");
}

/** What's wrong with typed tags, as the API would refuse them; `null` when nothing is. */
export function tagsProblem(text: string): string | null {
  const tags = parseTags(text);
  if (tags.length > 20) return "Up to 20 tags.";
  const long = tags.find((tag) => tag.length > 40);
  if (long) return `Keep each tag to 40 characters ("${long.slice(0, 20)}…" is longer).`;
  // The API's rule: a letter or digit first, then those, spaces and hyphens.
  const odd = tags.find((tag) => !/^[\p{L}\p{N}_][\p{L}\p{N}_ -]*$/u.test(tag));
  if (odd) {
    return `Tags start with a letter or digit and take letters, digits, spaces and hyphens ("${odd}" doesn't).`;
  }
  return null;
}
