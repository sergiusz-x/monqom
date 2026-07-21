import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, SectionCard } from "@/components/ui/card";

describe("card surfaces", () => {
  it("applies the shared default card surface", () => {
    render(<Card>Balance</Card>);

    const card = screen.getByText("Balance");
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card).toHaveClass("rounded-xl", "border", "bg-card", "p-4");
  });

  it("supports named tone, spacing, and elevation variants", () => {
    render(
      <Card tone="danger" padding="compact" elevation="raised">
        Destructive action
      </Card>,
    );

    expect(screen.getByText("Destructive action")).toHaveClass(
      "border-destructive/30",
      "bg-destructive/5",
      "p-3",
      "shadow-sm",
    );
  });

  it("renders content sections with responsive shared spacing", () => {
    render(<SectionCard aria-label="Workspace settings">Settings</SectionCard>);

    const section = screen.getByRole("region", {
      name: "Workspace settings",
    });
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveClass("rounded-xl", "p-4", "sm:p-6");
  });
});
