import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function ClaimTabs(props: { value?: string; onValueChange?: (v: string) => void }) {
  return (
    <Tabs defaultValue="overview" aria-label="Claim sections" {...props}>
      <TabsList aria-label="Claim sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="photos" count={48}>
          Photos
        </TabsTrigger>
        <TabsTrigger value="estimate" disabled>
          Estimate
        </TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="photos">Photos panel</TabsContent>
      <TabsContent value="estimate">Estimate panel</TabsContent>
      <TabsContent value="reports">Reports panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders a tablist with the default panel labelled by its tab", () => {
    render(<ClaimTabs />);

    expect(screen.getByRole("tablist", { name: "Claim sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toHaveTextContent("Overview panel");
  });

  it("includes the count in the tab name", () => {
    render(<ClaimTabs />);

    expect(screen.getByRole("tab", { name: "Photos 48" })).toBeInTheDocument();
  });

  it("switches panels on click", async () => {
    render(<ClaimTabs />);

    await userEvent.click(screen.getByRole("tab", { name: /Photos/ }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Photos panel");
  });

  it("moves with arrow keys, skipping disabled tabs, and supports End", async () => {
    render(<ClaimTabs />);

    await userEvent.tab();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Photos/ })).toHaveFocus();
    });

    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Reports" })).toHaveFocus();
    });

    await userEvent.keyboard("{Home}");
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
    });
  });

  it("works controlled", async () => {
    const onValueChange = vi.fn();
    render(<ClaimTabs value="reports" onValueChange={onValueChange} />);

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Reports panel");
    await userEvent.click(screen.getByRole("tab", { name: "Overview" }));

    expect(onValueChange).toHaveBeenCalledWith("overview");
  });
});
