import type { Schema } from "@claimforge/api-client";

import { LOSS_TYPE_LABEL, type LossType } from "./status";

export type DamageItem = Schema<"DamageItemRead">;
export type Surface = Schema<"Surface">;

/** Each surface as people say it. */
export const SURFACE_LABEL: Record<Surface, string> = {
  floor: "Floor",
  wall: "Wall",
  ceiling: "Ceiling",
  cabinetry: "Cabinetry",
  trim: "Trim",
  fixture: "Fixture",
  contents: "Contents",
  other: "Other",
};

export const SURFACES = Object.keys(SURFACE_LABEL) as Surface[];

/** IICRC S500 water categories, by how contaminated the water is. */
export const WATER_CATEGORY_LABEL: Record<number, string> = {
  1: "Category 1 (clean)",
  2: "Category 2 (grey)",
  3: "Category 3 (black)",
};

/** IICRC S500 water classes, by how much there is to dry. */
export const WATER_CLASS_LABEL: Record<number, string> = {
  1: "Class 1 (little)",
  2: "Class 2 (significant)",
  3: "Class 3 (most)",
  4: "Class 4 (specialty drying)",
};

/** Causes whose damage has a water category and class, as the API has them. */
const WATER_CAUSES: LossType[] = ["water", "flood", "sewage", "storm"];
/** Causes whose water is always Category 3. */
const BLACK_WATER_CAUSES: LossType[] = ["flood", "sewage"];

export const isWater = (cause: LossType) => WATER_CAUSES.includes(cause);
export const isBlackWater = (cause: LossType) => BLACK_WATER_CAUSES.includes(cause);

/** What an item is: "Floor · Laminate". */
export function damageTitle(item: DamageItem): string {
  return `${SURFACE_LABEL[item.surface]} · ${item.material}`;
}

/** Its cause, and for water its category and class: "Water · Category 1 (clean) · Class 2 (significant)". */
export function damageDetails(item: DamageItem): string {
  return [
    LOSS_TYPE_LABEL[item.cause],
    item.water_category !== null ? WATER_CATEGORY_LABEL[item.water_category] : null,
    item.water_class !== null ? WATER_CLASS_LABEL[item.water_class] : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Damage as its form holds it. */
export interface DamageDraft {
  room_id: string;
  surface: Surface | "";
  material: string;
  cause: LossType;
  /** "" for not known. */
  water_category: string;
  water_class: string;
  description: string;
}

export type DamageField = keyof DamageDraft;

export function damageDraftOf(item: DamageItem): DamageDraft {
  return {
    room_id: item.room_id,
    surface: item.surface,
    material: item.material,
    cause: item.cause,
    water_category: item.water_category === null ? "" : String(item.water_category),
    water_class: item.water_class === null ? "" : String(item.water_class),
    description: item.description ?? "",
  };
}

export function emptyDamageDraft(roomId: string, cause: LossType): DamageDraft {
  return {
    room_id: roomId,
    surface: "",
    material: "",
    cause,
    water_category: isBlackWater(cause) ? "3" : "",
    water_class: "",
    description: "",
  };
}

/** What's wrong with a draft, field by field, before the API is asked. */
export function damageProblems(draft: DamageDraft): Partial<Record<DamageField, string>> {
  const problems: Partial<Record<DamageField, string>> = {};
  if (!draft.surface) problems.surface = "Choose what's damaged.";
  const material = draft.material.trim();
  if (!material) problems.material = "Enter the material: drywall, carpet, laminate…";
  else if (material.length > 100) problems.material = "Keep this to 100 characters or fewer.";
  if (draft.description.trim().length > 2000) {
    problems.description = "Keep this to 2,000 characters or fewer.";
  }
  return problems;
}

type DamageBody = Schema<"DamageItemCreate">;

/**
 * The API's body for a checked draft. Water details go only with a water cause, flood
 * and sewage water as Category 3, so the API's rules hold before it's asked.
 */
export function toDamageBody(draft: DamageDraft): DamageBody {
  const water = isWater(draft.cause);
  const number = (raw: string) => (raw ? Number(raw) : null);
  return {
    surface: draft.surface || "other",
    material: draft.material.trim(),
    cause: draft.cause,
    water_category: !water ? null : isBlackWater(draft.cause) ? 3 : number(draft.water_category),
    water_class: water ? number(draft.water_class) : null,
    description: draft.description.trim() || null,
  };
}
