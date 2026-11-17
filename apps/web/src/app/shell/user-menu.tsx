import { useMe } from "@claimforge/api-client/react";
import {
  Avatar,
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Text,
} from "@claimforge/ui";
import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router";

import { useSignOut } from "../../auth/session";

/** Who is signed in, and the way to their settings or out. */
export function UserMenu() {
  const me = useMe();
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const name = me.data?.full_name ?? "Your account";
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Account: ${name}`}>
          <Avatar name={name} size="sm" />
          <Text as="span" weight="medium">
            {me.data?.full_name}
          </Text>
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        {me.data && <MenuLabel>{me.data.email}</MenuLabel>}
        <MenuItem
          icon={<Settings aria-hidden="true" />}
          onSelect={() => {
            void navigate("/settings");
          }}
        >
          Settings
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<LogOut aria-hidden="true" />} tone="danger" onSelect={signOut}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
