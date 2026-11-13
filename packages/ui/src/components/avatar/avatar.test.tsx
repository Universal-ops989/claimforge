import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, AvatarGroup, getAvatarColor, getInitials } from "./avatar";

describe("getInitials", () => {
  it.each([
    ["Dana Whitfield", "DW"],
    ["Dana K. Whitfield", "DW"],
    ["  maria  ", "M"],
    ["José Álvarez", "JÁ"],
    ["", ""],
  ])("%s -> %s", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

describe("getAvatarColor", () => {
  it("is deterministic", () => {
    expect(getAvatarColor("Dana Whitfield")).toBe(getAvatarColor("Dana Whitfield"));
  });
});

describe("Avatar", () => {
  it("is an image named after the person, showing initials without a photo", () => {
    render(<Avatar name="Dana Whitfield" />);

    expect(screen.getByRole("img", { name: "Dana Whitfield" })).toHaveTextContent("DW");
  });

  it("applies size and color classes", () => {
    render(<Avatar name="Dana Whitfield" size="lg" />);

    expect(screen.getByRole("img")).toHaveClass("lg", getAvatarColor("Dana Whitfield"));
  });
});

describe("AvatarGroup", () => {
  const people = ["Ana Ruiz", "Ben Ode", "Cal Ng", "Dee Park", "Eli Shaw"].map((name) => ({
    name,
  }));

  it("shows up to max avatars and names the hidden ones", () => {
    render(<AvatarGroup people={people} max={3} />);

    expect(screen.getByRole("group", { name: "5 people" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ana Ruiz" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Dee Park" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "and 2 more: Dee Park, Eli Shaw" })).toHaveTextContent(
      "+2",
    );
  });

  it("omits the counter when everyone fits", () => {
    render(<AvatarGroup people={people.slice(0, 2)} />);

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
