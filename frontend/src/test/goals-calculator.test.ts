import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  monthsUntilDate,
  previewMonthlyAmount,
  todayInTimeZone,
} from "@/lib/goals";

describe("goal planning helpers", () => {
  it("keeps the deadline slider and date clamped at month ends", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(monthsUntilDate("2026-01-31", "2026-02-28")).toBe(1);
    expect(monthsUntilDate("2026-01-31", "2026-03-01")).toBe(2);
  });

  it("defaults to next month and rounds the live monthly amount up", () => {
    expect(
      previewMonthlyAmount({
        targetAmountCents: 100_00,
        initialAmountCents: 20_00,
        today: "2026-08-19",
        targetDate: "2026-11-19",
        includeCurrentMonth: false,
      }),
    ).toEqual({ months: 3, monthlyAmountCents: 2667 });
  });

  it("optionally includes the current month", () => {
    expect(
      previewMonthlyAmount({
        targetAmountCents: 100_00,
        initialAmountCents: 0,
        today: "2026-08-19",
        targetDate: "2026-09-19",
        includeCurrentMonth: true,
      }),
    ).toEqual({ months: 2, monthlyAmountCents: 50_00 });
  });

  it("uses the workspace timezone for today's date", () => {
    expect(todayInTimeZone("Europe/Warsaw", new Date("2026-08-19T22:30:00Z"))).toBe(
      "2026-08-20",
    );
  });
});
