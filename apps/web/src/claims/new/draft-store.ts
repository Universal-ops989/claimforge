import { LOSS_TYPE_LABEL } from "../status";
import { EMPTY_DRAFT, type ClaimDraft } from "./draft";

export type DraftStep = "property" | "loss" | "review";

export interface SavedDraft {
  draft: ClaimDraft;
  step: DraftStep;
}

const PROPERTY_TYPES = ["residential", "multi_family", "commercial", "industrial", "other"];
const LOSS_TYPES = Object.keys(LOSS_TYPE_LABEL);
const STEPS: DraftStep[] = ["property", "loss", "review"];

/** Whether anything has been typed: a draft worth keeping, and worth asking before losing. */
export function hasContent(draft: ClaimDraft): boolean {
  const differs = (section: "property" | "loss") =>
    Object.entries(draft[section]).some(
      ([name, value]) => value !== (EMPTY_DRAFT[section] as Record<string, string>)[name],
    );
  return differs("property") || differs("loss");
}

/** `value[name]` when it's a string, else the empty draft's. */
function textFrom<Section extends "property" | "loss">(
  section: Section,
  value: unknown,
): ClaimDraft[Section] {
  const empty = EMPTY_DRAFT[section] as Record<string, string>;
  const given = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  return Object.fromEntries(
    Object.keys(empty).map((name) => {
      const field = given[name];
      return [name, typeof field === "string" ? field : empty[name]];
    }),
  ) as ClaimDraft[Section];
}

/** Saved text read back as a draft; `null` for anything that doesn't look like one. */
export function parseSavedDraft(text: string | null): SavedDraft | null {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const saved = value as { draft?: unknown; step?: unknown };
  if (typeof saved.draft !== "object" || saved.draft === null) return null;
  const sections = saved.draft as { property?: unknown; loss?: unknown };
  const draft: ClaimDraft = {
    property: textFrom("property", sections.property),
    loss: textFrom("loss", sections.loss),
  };
  // Choices from a list must still be on the list.
  const propertyType: string = draft.property.property_type;
  if (!PROPERTY_TYPES.includes(propertyType)) {
    draft.property.property_type = EMPTY_DRAFT.property.property_type;
  }
  const lossType: string = draft.loss.loss_type;
  if (lossType && !LOSS_TYPES.includes(lossType)) {
    draft.loss.loss_type = "";
  }
  const step = STEPS.find((s) => s === saved.step) ?? "property";
  return { draft, step };
}

/** The draft of one organization's new claim, in this tab's session. */
export function createDraftStore(storage: Storage | null, organizationId: string) {
  const key = `claimforge.new-claim.${organizationId}`;
  return {
    read: (): SavedDraft | null => {
      try {
        return parseSavedDraft(storage?.getItem(key) ?? null);
      } catch {
        return null;
      }
    },
    save: (draft: ClaimDraft, step: DraftStep): void => {
      try {
        if (hasContent(draft)) storage?.setItem(key, JSON.stringify({ draft, step }));
        else storage?.removeItem(key);
      } catch {
        // Not kept: the form still works, it just won't survive a reload.
      }
    },
    clear: (): void => {
      try {
        storage?.removeItem(key);
      } catch {
        // Nothing was kept anyway.
      }
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
