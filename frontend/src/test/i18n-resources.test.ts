import { afterEach, describe, expect, it } from "vitest";
import i18n, { resources } from "@/i18n";
import { translateSystemLabel } from "@/i18n/translate-system-label";

function leafKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof nestedValue === "string"
      ? [path]
      : leafKeys(nestedValue as object, path);
  });
}

describe("modular i18n resources", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("keeps Polish and English resource keys in exact parity", () => {
    expect(leafKeys(resources.pl.translation).sort()).toEqual(
      leafKeys(resources.en.translation).sort(),
    );
  });

  it("translates known server system keys", async () => {
    await i18n.changeLanguage("pl");

    expect(
      translateSystemLabel(i18n.t, "categories.groceries", "Backend groceries"),
    ).toBe("Zakupy spożywcze");
  });

  it("preserves the API label for unknown or user-defined keys", async () => {
    await i18n.changeLanguage("pl");

    expect(
      translateSystemLabel(
        i18n.t,
        "categories.future-category",
        "Moja przyszła kategoria",
      ),
    ).toBe("Moja przyszła kategoria");
    expect(translateSystemLabel(i18n.t, null, "Własna kategoria")).toBe(
      "Własna kategoria",
    );
  });
});
