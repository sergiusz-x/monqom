import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import type { ReactNode } from "react";
import { SpendingByCategoryChart } from "@/components/dashboard/SpendingByCategoryChart";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

// Render cells without depending on jsdom layout/ResizeObserver. The real
// chart component still executes its category mapping and fill calculation.
vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Bar: Container,
    BarChart: Container,
    ResponsiveContainer: Container,
    CartesianGrid: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Cell: ({ fill, onClick }: { fill: string; onClick: () => void }) => (
      <button data-testid="category-bar" data-fill={fill} onClick={onClick} />
    ),
  };
});

function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderChart() {
  return render(
    <MemoryRouter>
      <AppErrorBoundary>
        <SpendingByCategoryChart
          month="2026-10"
          breakdown={{
            month: "2026-10",
            currency: "PLN",
            totalSpending: 100,
            categories: [
              {
                categoryId: null,
                categoryName: "Uncategorized",
                categoryColor: null,
                amount: 70,
                percentage: 70,
              },
              {
                categoryId: "food",
                categoryName: "Food",
                categoryColor: "#16a34a",
                amount: 30,
                percentage: 30,
              },
            ],
          }}
        />
      </AppErrorBoundary>
      <Location />
    </MemoryRouter>,
  );
}

describe("uncategorized spending", () => {
  it("renders a positive uncategorized group without crashing the app", () => {
    renderChart();
    const bars = screen.getAllByTestId("category-bar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute(
      "data-fill",
      expect.stringMatching(/^var\(--chart-/),
    );
    expect(bars[1]).toHaveAttribute("data-fill", "#16a34a");
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("opens uncategorized transactions with the chart month, without a null ID", async () => {
    renderChart();
    await userEvent.click(screen.getAllByTestId("category-bar")[0]!);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/transactions?category_status=uncategorized&date_from=2026-10-01&date_to=2026-10-31",
    );
  });

  it("preserves navigation to a normal category", async () => {
    renderChart();
    await userEvent.click(screen.getAllByTestId("category-bar")[1]!);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/transactions?category_id=food&date_from=2026-10-01&date_to=2026-10-31",
    );
  });
});
