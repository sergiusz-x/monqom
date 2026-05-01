import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import type { SpendingTrendItem } from "@/types/dashboard";

const trend: SpendingTrendItem[] = [
  { month: "2025-12", total: 0 },
  { month: "2026-01", total: 25 },
  { month: "2026-02", total: 50 },
  { month: "2026-03", total: 0 },
  { month: "2026-04", total: 75 },
  { month: "2026-05", total: 100 },
];

function renderChart(data = trend) {
  return render(
    <SpendingTrendChart trend={data} currency="USD" currentMonth="2026-05" />,
  );
}

describe("SpendingTrendChart", () => {
  it("renders six monthly spending bars with x-axis labels", () => {
    renderChart();

    expect(
      screen.getByLabelText("Monthly spending amounts"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByText("Dec")).toBeInTheDocument();
    expect(screen.getByText("May")).toBeInTheDocument();
  });

  it("highlights the current month", () => {
    renderChart();

    expect(
      screen.getByRole("button", { name: /may 2026 spending \$100\.00/i }),
    ).toHaveAttribute("aria-current", "date");
  });

  it("shows exact amount when a month is clicked", async () => {
    const user = userEvent.setup();
    renderChart();

    await user.click(
      screen.getByRole("button", { name: /february 2026 spending \$50\.00/i }),
    );

    expect(screen.getByText(/february 2026:/i)).toHaveTextContent("$50.00");
  });

  it("keeps zero-spending months visible", () => {
    renderChart();

    expect(
      screen.getByRole("button", { name: /december 2025 spending \$0\.00/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /march 2026 spending \$0\.00/i }),
    ).toBeInTheDocument();
  });
});
