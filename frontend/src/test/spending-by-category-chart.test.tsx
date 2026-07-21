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

  it("adds tokenized fallbacks and distinct non-color patterns", () => {
    renderChart();

    const groceriesBar = screen.getByRole("img", {
      name: /groceries spending share 80%/i,
    }).firstElementChild;
    const coffeeBar = screen.getByRole("img", {
      name: /coffee spending share 20%/i,
    }).firstElementChild;

    expect(groceriesBar).toHaveAttribute("data-pattern", "chart-pattern-1");
    expect(coffeeBar).toHaveAttribute("data-pattern", "chart-pattern-2");
    expect(coffeeBar).toHaveStyle({ backgroundColor: "var(--chart-2)" });
    expect(coffeeBar).toHaveClass("border-foreground/20");
  });

  it("handles no spending gracefully", () => {
    renderChart(makeBreakdown({ totalSpending: 0, categories: [] }));

    expect(screen.getByText("No category spending yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add expenses for this month to see your category breakdown.",
      ),
    ).toBeInTheDocument();
  });
});
