import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, CardBody, CardFooter, CardHeader } from "./card";

describe("Card", () => {
  it("composes header, body and footer with a real heading", () => {
    render(
      <Card data-testid="card">
        <CardHeader
          title="Kitchen"
          description="Category 2 · Class 2"
          actions={<button type="button">Edit</button>}
        />
        <CardBody>14 readings</CardBody>
        <CardFooter divided>Updated 2h ago</CardFooter>
      </Card>,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Kitchen" })).toBeInTheDocument();
    expect(screen.getByText("Category 2 · Class 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("Updated 2h ago")).toHaveClass("footer", "divided");
    expect(screen.getByTestId("card")).toHaveClass("root", "outlined", "padding-md");
  });

  it("supports a custom heading level", () => {
    render(
      <Card>
        <CardHeader title="Claim summary" headingLevel={2} />
      </Card>,
    );

    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("renders as a link when asChild is used", () => {
    render(
      <Card asChild interactive variant="elevated">
        <a href="/claims/CF-1042">Claim CF-1042</a>
      </Card>,
    );

    const link = screen.getByRole("link", { name: "Claim CF-1042" });
    expect(link).toHaveAttribute("href", "/claims/CF-1042");
    expect(link).toHaveClass("root", "elevated", "interactive");
  });
});
