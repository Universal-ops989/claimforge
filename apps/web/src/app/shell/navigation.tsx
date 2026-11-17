import { SidebarNav, type NavSection } from "@claimforge/ui";
import { ClipboardList, LayoutDashboard, Settings } from "lucide-react";
import { Link, useLocation } from "react-router";

import { inOrganization, useOrganization } from "../organization";

/**
 * The app's sections, as paths inside the organization (`""` is its dashboard). `match`
 * decides, from the path after the organization, when a section is the current one.
 */
const SECTIONS: {
  label: string;
  path: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
}[] = [
  {
    label: "Dashboard",
    path: "",
    icon: <LayoutDashboard aria-hidden="true" />,
    match: (path) => path === "",
  },
  {
    label: "Claims",
    path: "claims",
    icon: <ClipboardList aria-hidden="true" />,
    match: (path) => path === "claims" || path.startsWith("claims/"),
  },
  {
    label: "Settings",
    path: "settings",
    icon: <Settings aria-hidden="true" />,
    match: (path) => path === "settings" || path.startsWith("settings/"),
  },
];

/** The sidebar's navigation, with the section the user is in marked as current. */
export function Navigation() {
  const { pathname } = useLocation();
  const { slug } = useOrganization();
  const inside = pathname.split("/").slice(2).join("/");
  const sections: NavSection[] = [
    {
      items: SECTIONS.map(({ label, path, icon, match }) => ({
        label,
        icon,
        href: inOrganization(slug, path),
        active: match(inside),
      })),
    },
  ];
  return (
    <SidebarNav
      sections={sections}
      renderLink={({ item, className, children, onClick, "aria-current": current }) => (
        <Link to={item.href} className={className} onClick={onClick} aria-current={current}>
          {children}
        </Link>
      )}
    />
  );
}
