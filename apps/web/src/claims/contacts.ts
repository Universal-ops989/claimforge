import type { Schema } from "@claimforge/api-client";

export type ContactRole = Schema<"ClaimContactRole">;
export type ContactKind = Schema<"ContactKind">;

/** A contact's part in a claim, as people say it. */
export const CONTACT_ROLE_LABEL: Record<ContactRole, string> = {
  insured: "Insured",
  co_insured: "Co-insured",
  tenant: "Tenant",
  property_manager: "Property manager",
  public_adjuster: "Public adjuster",
  insurance_agent: "Insurance agent",
  carrier_adjuster: "Carrier's adjuster",
  other: "Other",
};

/** The parts, in the order they're offered: the insured first. */
export const CONTACT_ROLES = Object.keys(CONTACT_ROLE_LABEL) as ContactRole[];

/**
 * The part a kind of contact usually plays on a claim (a policyholder is the insured),
 * offered first when they're chosen; and the other way, the kind someone new is filed
 * under in the address book from the part they play.
 */
const ROLE_FOR_KIND: Record<ContactKind, ContactRole> = {
  policyholder: "insured",
  tenant: "tenant",
  property_manager: "property_manager",
  public_adjuster: "public_adjuster",
  insurance_agent: "insurance_agent",
  carrier_adjuster: "carrier_adjuster",
  contractor: "other",
  other: "other",
};

export function roleFor(kind: ContactKind): ContactRole {
  return ROLE_FOR_KIND[kind];
}

export function kindFor(role: ContactRole): ContactKind {
  return role === "insured" || role === "co_insured" ? "policyholder" : role;
}

/** How someone prefers to be reached, as a phrase: "Prefers a call". */
export const PREFERS: Record<Schema<"ContactMethod">, string> = {
  phone: "Prefers a call",
  text: "Prefers a text",
  email: "Prefers email",
};
