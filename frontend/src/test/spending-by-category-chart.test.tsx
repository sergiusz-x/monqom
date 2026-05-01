import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SpendingByCategoryChart } from "@/components/dashboard/SpendingByCategoryChart";
import type { CategoryBreakdown } from "@/types/dashboard";

function makeBreakdown(
  overrides: Partial<CategoryBreakdown> = {},
): CategoryBreakdown {
  return {
    month: "2026-04",
    currency: "USD",
    total_spending: 100,
    categories: [
      {
        category_id: "cat-small",
        category_name: "Coffee",
        category_color: null,
        amount: 20,
        percentage: 20,
      },
      {
        category_id: "cat-large",
        category_name: "Groceries",
        category_color: "#16a34a",
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
  it("renders categories sorted by spending with amounts and percentages", () => {
    renderChart();

    const links = screen.getAllByRole("link");
    expect(within(links[0]).getByText("Groceries")).toBeInTheDocument();
    expect(within(links[0]).getByText("$80.00")).toBeInTheDocument();
    expect(within(links[0]).getByText("80%")).toBeInTheDocument();
    expect(within(links[1]).getByText("Coffee")).toBeInTheDocument();
    expect(within(links[1]).getByText("$20.00")).toBeInTheDocument();
    expect(within(links[1]).getByText("20%")).toBeInTheDocument();
  });

  it("links categories to the transaction list filtered by category and month", () => {
    renderChart();

    expect(screen.getByRole("link", { name: /groceries/i })).toHaveAttribute(
      "href",
      "/transactions?category_id=cat-large&date_from=2026-04-01&date_to=2026-04-30",
    );
  });

  it("uses category colors for chart bars", () => {
    renderChart();

    expect(
      screen.getByRole("img", { name: /groceries spending share 80%/i })
        .firstElementChild,
    ).toHaveStyle({ backgroundColor: "#16a34a", width: "80%" });
  });

  it("handles no spending gracefully", () => {
    renderChart(makeBreakdown({ total_spending: 0, categories: [] }));

    expect(screen.getByText("No category spending yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add expenses for this month to see your category breakdown.",
      ),
    ).toBeInTheDocument();
  });
});
