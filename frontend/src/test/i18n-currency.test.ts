import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getIntlLocale } from "@/lib/locale";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { formatCurrency, formatMinorUnits } from "@/lib/money";
import {
  formatLongDate,
  formatMonth,
  formatShortDate,
  formatShortMonth,
} from "@/lib/date-only";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("locale and currency configuration", () => {
  it("switches application copy and Intl locale between English and Polish", async () => {
    await i18n.changeLanguage("pl");

    expect(i18n.t("nav.dashboard")).toBe("Pulpit");
    expect(i18n.t("categories.groceries")).toBe("Zakupy spożywcze");
    expect(getIntlLocale()).toBe("pl-PL");

    await i18n.changeLanguage("en");
    expect(i18n.t("nav.dashboard")).toBe("Dashboard");
    expect(getIntlLocale()).toBe("en-US");
  });

  it("exposes the complete unique allowlist of selectable currencies", () => {
    expect(SUPPORTED_CURRENCIES).toEqual([
      "PLN",
      "EUR",
      "USD",
      "GBP",
      "CHF",
      "CZK",
      "SEK",
      "NOK",
      "DKK",
      "HUF",
      "RON",
    ]);
    expect(new Set(SUPPORTED_CURRENCIES).size).toBe(
      SUPPORTED_CURRENCIES.length,
    );
  });

  it("uses one two-decimal currency policy in every locale", async () => {
    await i18n.changeLanguage("en");
    expect(formatCurrency(12, "USD")).toBe("$12.00");
    expect(formatCurrency(12, "HUF")).toBe("HUF 12.00");
    expect(formatMinorUnits(1200)).toBe("12.00");

    await i18n.changeLanguage("pl");
    expect(formatCurrency(12, "PLN")).toBe("12,00 zł");
    expect(formatMinorUnits(1200)).toBe("12,00");
  });

  it("shares timezone-safe short, long, and month formatting", async () => {
    await i18n.changeLanguage("en");
    expect(formatShortDate("2026-07-01T23:59:59.000Z")).toBe("Jul 1, 2026");
    expect(formatLongDate("2026-07-01")).toBe("July 1, 2026");
    expect(formatShortMonth("2026-07")).toBe("Jul");
    expect(formatMonth("2026-07")).toBe("July 2026");
    expect(formatMonth("not-a-month")).toBe("not-a-month");
  });
});
