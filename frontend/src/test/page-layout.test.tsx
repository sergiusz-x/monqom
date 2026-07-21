import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";

describe("page layout", () => {
  it("provides one responsive width and spacing boundary", () => {
    render(<PageContainer>Content</PageContainer>);
    const container = screen.getByText("Content");
    expect(container).toHaveClass("max-w-5xl", "px-4", "sm:px-6", "py-6");
  });

  it("renders a consistent heading, description, and actions", () => {
    render(
      <PageHeader
        title="Transactions"
        description="Manage spending"
        actions={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Transactions",
    );
    expect(screen.getByText("Manage spending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("supports an accessible visually hidden page title", () => {
    render(<PageHeader title="Dashboard" visuallyHidden />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("sr-only");
  });
});
