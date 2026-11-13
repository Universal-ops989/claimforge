import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";
import { SidebarNav, type NavSection } from "./sidebar-nav";

const SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: <svg /> },
      { label: "Claims", href: "/claims", icon: <svg />, active: true, badge: 3 },
    ],
  },
  { label: "Admin", items: [{ label: "Settings", href: "/settings", icon: <svg /> }] },
];

function Shell(props: { collapsed?: boolean; onCollapsedChange?: (c: boolean) => void }) {
  return (
    <AppShell
      brand="ClaimForge"
      navigation={<SidebarNav sections={SECTIONS} />}
      topbarStart={<h1>Claims</h1>}
      topbarEnd={<button type="button">Notifications</button>}
      {...props}
    >
      <p>Page content</p>
    </AppShell>
  );
}

describe("AppShell", () => {
  it("provides landmarks and a skip link to main content", () => {
    render(<Shell />);

    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main",
    );
    expect(screen.getByRole("banner")).toHaveTextContent("Claims");
    expect(screen.getByRole("main")).toHaveTextContent("Page content");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("marks the active item and shows badges", () => {
    render(<Shell />);
    const nav = screen.getByRole("navigation", { name: "Main" });

    const active = within(nav).getByRole("link", { name: /Claims/ });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveTextContent("3");
    expect(within(nav).getByText("Admin")).toBeInTheDocument();
  });

  it("collapses the sidebar but keeps accessible link names", async () => {
    const onCollapsedChange = vi.fn();
    render(<Shell onCollapsedChange={onCollapsedChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: /Dashboard/ })).toBeInTheDocument();
    expect(within(nav).queryByText("Admin")).not.toBeInTheDocument();
  });

  it("opens a navigation drawer on small screens and closes it after navigating", async () => {
    render(<Shell />);

    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const drawer = screen.getByRole("dialog", { name: "ClaimForge" });
    await userEvent.click(within(drawer).getByRole("link", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
