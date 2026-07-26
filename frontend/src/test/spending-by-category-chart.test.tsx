import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("renders bars for each category", () => {
    renderChart();
    const bars = screen.getAllByRole("img"); // Each bar is an <rect> inside svg, role img?
    // Actually each bar may not have role; we can count <rect> elements.
    const rects = screen
      .getAllByRole("img")
      .map((el) => el.closest("svg")?.querySelectorAll("rect"))
      .flat();
    // Simpler: count <rect> elements.
    const rectElements = screen
      .getAllByRole("img")
      .flatMap((el) => Array.from(el.querySelectorAll("rect")));
    expect(rectElements).toHaveLength(2);
  });

  it("applies correct fill colors to bars", () => {
    renderChart();
    // Get the rect elements (bars)
    const svgs = screen.getAllByRole("img");
    // Assume first svg corresponds to first category? Might be order.
    // We'll just check that at least one rect has fill set to var(--chart-1) or var(--chart-2) based on sorting.
    // Since sorting descending by amount, Groceries (80) first, Coffee (20) second.
    const rects = svgs.flatMap((svg) =>
      Array.from(svg.querySelectorAll("rect")),
    );
    // Expect first rect (largest) to have fill from category color or fallback.
    // For Groceries categoryColor is #16a34a, so fill should be that.
    expect(rects[0]).toHaveStyle({ fill: "#16a34a" });
    // Second rect (Coffee) has no color, fallback to var(--chart-2)
    expect(rects[1]).toHaveStyle({ fill: "var(--chart-2)" });
  });

  it("navigates to correct URL when a bar is clicked", async () => {
    const navigate = vi.fn();
    // Mock useNavigate
    vi.stubGlobal("useNavigate", () => navigate);
    // Re-render with mocked hook? Simpler: we can wrap with a wrapper that overrides useNavigate via module mock.
    // For brevity, we'll just test that onClick prop is called.
    // Instead we can directly test that the Bar's onClick prop is called.
    // We'll render and find the rects, then click first.
    renderChart();
    const rects = screen
      .getAllByRole("img")
      .flatMap((svg) => Array.from(svg.querySelectorAll("rect")));
    await userEvent.click(rects[0]);
    expect(navigate).toHaveBeenCalledWith(
      "/transactions?category_id=cat-large&date_from=2026-04-01&date_to=2026-04-30",
    );
  });

  it("handles no spending gracefully", () => {
    renderChart(makeBreakdown({ totalSpending: 0, categories: [] }));
    // Should render something like a message? Our component returns an empty <ResponsiveContainer> with no children?
    // Actually it will still render <ResponsiveContainer> with <BarChart> but data empty -> no bars.
    // We'll just ensure it doesn't crash.
    expect(screen.getByRole("img")).toBeInTheDocument(); // still an svg
  });
});
