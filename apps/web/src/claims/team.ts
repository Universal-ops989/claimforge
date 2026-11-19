import type { Schema } from "@claimforge/api-client";

export type AssignmentRole = Schema<"AssignmentRole">;
type Permission = Schema<"Permission">;

/** Each role on a claim as people say it. */
export const ASSIGNMENT_ROLE_LABEL: Record<AssignmentRole, string> = {
  adjuster: "Adjuster",
  field_technician: "Field technician",
  contractor: "Contractor",
};

/** Roles in the order they're offered: the adjuster first. */
export const ASSIGNMENT_ROLES: AssignmentRole[] = ["adjuster", "field_technician", "contractor"];

/**
 * What a member must be allowed to take each role, as the API checks it: adjusters need
 * `claims:write`; field technicians and contractors `field_data:write`.
 */
const NEEDS: Record<AssignmentRole, Permission> = {
  adjuster: "claims:write",
  field_technician: "field_data:write",
  contractor: "field_data:write",
};

/** The roles someone with `permissions` can be given on a claim. */
export function rolesFor(permissions: readonly Permission[]): AssignmentRole[] {
  return ASSIGNMENT_ROLES.filter((role) => permissions.includes(NEEDS[role]));
}
