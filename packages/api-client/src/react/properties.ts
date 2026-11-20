/**
 * Properties: the buildings claims are about. A property can be on several claims (a
 * second loss at the same address), and every claim carries its property, so a change
 * refreshes the organization's claims.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { RequestBody } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";

const PROPERTY = "/v1/organizations/{organization_id}/properties/{property_id}";

export interface PropertyChange {
  propertyId: string;
  changes: RequestBody<typeof PROPERTY, "patch">;
}

/**
 * Change a property: its address, type, year built or access notes. Moving it to an
 * address another property has is refused (`property_exists`).
 */
export function useUpdateProperty(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, changes }: PropertyChange) =>
      api.patch(PROPERTY, {
        path: { organization_id: organizationId, property_id: propertyId },
        body: changes,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.claims(organizationId) }),
  });
}
