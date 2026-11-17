import { useMe } from "@claimforge/api-client/react";
import {
  Button,
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuLabel,
  MenuTrigger,
  Text,
} from "@claimforge/ui";
import { Building, ChevronsUpDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { inOrganization, useOrganization } from "../organization";

/**
 * The current organization, at the foot of the sidebar; for someone in several, a menu
 * of them. Switching keeps the section (a claims list stays a claims list) but not a
 * claim, which belongs to the organization it came from.
 */
export function OrganizationSwitcher() {
  const current = useOrganization();
  const me = useMe();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const memberships = me.data?.memberships ?? [];
  const section = pathname.split("/")[2] ?? "";

  const label = (
    <>
      <Building aria-hidden="true" size={16} />
      <Text as="span" weight="medium" truncate>
        {current.name}
      </Text>
    </>
  );

  if (memberships.length < 2) {
    return (
      <div style={{ display: "flex", gap: "var(--cf-space-2)", alignItems: "center" }}>{label}</div>
    );
  }
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          aria-label={`Organization: ${current.name}. Switch organization`}
          trailingIcon={<ChevronsUpDown aria-hidden="true" size={16} />}
        >
          {label}
        </Button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuLabel>Your organizations</MenuLabel>
        {memberships.map(({ organization }) => (
          <MenuCheckboxItem
            key={organization.id}
            checked={organization.id === current.id}
            onSelect={() => {
              void navigate(inOrganization(organization.slug, section));
            }}
          >
            {organization.name}
          </MenuCheckboxItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
