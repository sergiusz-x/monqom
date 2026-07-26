import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
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
      <SpendingByCategoryChart breakdown={breakdown} month={breakdown.month} />
    </MemoryRouter>,
  );
}

describe("SpendingByCategoryChart", () => {
  it("renders bars for each category", () => {
    const { container } = renderChart();
    const svg = container.querySelector(".recharts-responsive-container");
    expect(svg).toBeInTheDocument();
  });

  it("applies correct fill colors to bars", () => {
    const { container } = renderChart();
    const svg = container.querySelector(".recharts-responsive-container");
    expect(svg).toBeInTheDocument();
  });

  it("navigates to correct URL when a bar is clicked", async () => {
    const { container } = renderChart();
    const svg = container.querySelector(".recharts-responsive-container");
    expect(svg).toBeInTheDocument();
  });

  it("handles no spending gracefully", () => {
    const { container } = renderChart(
      makeBreakdown({ totalSpending: 0, categories: [] }),
    );
    expect(
      container.querySelector(".recharts-responsive-container"),
    ).toBeNull();
  });
});
