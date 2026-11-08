import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SpendingByCategoryChart } from "@/components/dashboard/SpendingByCategoryChart";
import type { CategoryBreakdown } from "@/types/dashboard";

function makeBreakdown(
  overrides: Partial<CategoryBreakdown> = {},
): CategoryBreakdown {
  return {
    month: "2026-04",
    currency: "USD",
    totalSpending: 100,
    categories: [
      {
        categoryId: "cat-small",
        categoryName: "Coffee",
        categoryColor: null,
        amount: 20,
        percentage: 20,
      },
      {
        categoryId: "cat-large",
        categoryName: "Groceries",
        categoryColor: "#16a34a",
        amount: 80,
        percentage: 80,
      },
    ],
    ...overrides,
  };
}

function renderChart(breakdown = makeBreakdown()) {
  return render(
    <MemoryRouter>
      <SpendingByCategoryChart
        breakdown={breakdown}
        month={breakdown.month}
        categories={[]}
      />
    </MemoryRouter>,
  );
}

describe("SpendingByCategoryChart", () => {
  it("shows categories ordered by spending with amounts and shares", () => {
    renderChart();
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Groceries");
    expect(links[0]).toHaveTextContent("80%");
    expect(links[1]).toHaveTextContent("Coffee");
  });

  it("groups subcategories with their parent so the link matches the shown total", () => {
    const parent = {
      id: "parent",
      name: "Food",
      icon: "🍽️",
      parentId: null,
      sortOrder: 0,
      children: [
        {
          id: "cat-small",
          name: "Coffee",
          icon: null,
          parentId: "parent",
          sortOrder: 0,
          children: [],
        },
      ],
    };
    const breakdown = makeBreakdown({
      categories: [
        {
          categoryId: "parent",
          categoryName: "Food",
          categoryColor: null,
          amount: 80,
          percentage: 80,
        },
        {
          categoryId: "cat-small",
          categoryName: "Coffee",
          categoryColor: null,
          amount: 20,
          percentage: 20,
        },
      ],
    });
    render(
      <MemoryRouter>
        <SpendingByCategoryChart
          breakdown={breakdown}
          month={breakdown.month}
          categories={[parent]}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Food/ });
    expect(link).toHaveTextContent("$100.00");
    expect(link).toHaveTextContent("100%");
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("category_id=parent"),
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("handles no spending gracefully", () => {
    renderChart(makeBreakdown({ totalSpending: 0, categories: [] }));
    expect(screen.getByText("No category spending yet")).toBeInTheDocument();
  });
});
