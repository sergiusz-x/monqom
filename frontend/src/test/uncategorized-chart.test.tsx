import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { SpendingByCategoryChart } from "@/components/dashboard/SpendingByCategoryChart";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

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
          categories={[]}
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
    expect(
      screen.getByRole("link", { name: /Uncategorized/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Food/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("opens uncategorized transactions with the chart month, without a null ID", async () => {
    renderChart();
    await userEvent.click(screen.getByRole("link", { name: /Uncategorized/ }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/transactions?category_status=uncategorized&date_from=2026-10-01&date_to=2026-10-31&type=expense",
    );
  });

  it("preserves navigation to a normal category", async () => {
    renderChart();
    await userEvent.click(screen.getByRole("link", { name: /Food/ }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/transactions?category_id=food&date_from=2026-10-01&date_to=2026-10-31&type=expense",
    );
  });
});
