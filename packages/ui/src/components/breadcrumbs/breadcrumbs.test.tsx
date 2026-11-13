import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";

const TRAIL: BreadcrumbItem[] = [
  { label: "Claims", href: "/claims" },
  { label: "CF-1042", href: "/claims/CF-1042" },
  { label: "Rooms", href: "/claims/CF-1042/rooms" },
  { label: "Kitchen" },
];

describe("Breadcrumbs", () => {
  it("renders a labelled ordered list with the current page last", () => {
    render(<Breadcrumbs items={TRAIL} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const list = within(nav).getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Claims", "CF-1042", "Rooms"]);
    expect(screen.getByText("Kitchen")).toHaveAttribute("aria-current", "page");
  });

  it("collapses middle items beyond maxItems", () => {
    render(<Breadcrumbs items={TRAIL} maxItems={3} />);

    // Three visible entries: Claims · … · Kitchen.
    expect(screen.getByLabelText("More levels")).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Claims"]);
    expect(screen.getByText("Kitchen")).toHaveAttribute("aria-current", "page");
  });

  it("delegates links to a router", () => {
    render(
      <Breadcrumbs
        items={TRAIL}
        renderLink={(item, className) => (
          <a data-router="true" href={`#${item.href}`} className={className}>
            {item.label}
          </a>
        )}
      />,
    );

    expect(screen.getByRole("link", { name: "Claims" })).toHaveAttribute("data-router", "true");
  });
});
