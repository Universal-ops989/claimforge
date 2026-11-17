import { SidebarNav, type NavSection } from "@claimforge/ui";
import { ClipboardList, LayoutDashboard, Settings } from "lucide-react";
import { Link, useLocation } from "react-router";

/** The app's sections. `match` decides when a section is the current one. */
const SECTIONS: {
  label: string;
  href: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
}[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard aria-hidden="true" />,
    match: (path) => path === "/",
  },
  {
    label: "Claims",
    href: "/claims",
    icon: <ClipboardList aria-hidden="true" />,
    match: (path) => path === "/claims" || path.startsWith("/claims/"),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings aria-hidden="true" />,
    match: (path) => path === "/settings" || path.startsWith("/settings/"),
  },
];

/** The sidebar's navigation, with the section the user is in marked as current. */
export function Navigation() {
  const { pathname } = useLocation();
  const sections: NavSection[] = [
    {
      items: SECTIONS.map(({ match, ...item }) => ({ ...item, active: match(pathname) })),
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
