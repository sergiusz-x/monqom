import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  formatDateOnly,
  getDateOnlyInTimeZone,
  getMonthDateRange,
  getMonthInTimeZone,
  normalizeDateOnly,
  shiftMonth,
} from "@/lib/date-only";

describe("date-only and workspace timezone helpers", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("validates real calendar dates without parsing them as timestamps", () => {
    expect(normalizeDateOnly("2024-02-29")).toBe("2024-02-29");
    expect(normalizeDateOnly("2026-02-29")).toBeNull();
    expect(normalizeDateOnly("2026-07-01T23:59:00.000Z")).toBe("2026-07-01");
  });

  it("formats the calendar day without a local timezone shift", async () => {
    await i18n.changeLanguage("en");
    expect(
      formatDateOnly("2026-07-01T00:00:00.000Z", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    ).toBe("Jul 1, 2026");
  });

  it("derives current dates and report months from the workspace timezone", () => {
    const instant = new Date("2026-07-01T00:30:00.000Z");

    expect(getDateOnlyInTimeZone(instant, "America/Los_Angeles")).toBe(
      "2026-06-30",
    );
    expect(getMonthInTimeZone(instant, "America/Los_Angeles")).toBe("2026-06");
    expect(getDateOnlyInTimeZone(instant, "Europe/Warsaw")).toBe("2026-07-01");
    expect(getMonthInTimeZone(instant, "Europe/Warsaw")).toBe("2026-07");
  });

  it("handles month boundaries and leap years in calendar space", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(getMonthDateRange("2024-02")).toEqual({
      dateFrom: "2024-02-01",
      dateTo: "2024-02-29",
    });
  });
});
