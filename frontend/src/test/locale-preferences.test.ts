import { describe, expect, it } from "vitest";
import { resolveLocale } from "@monqom/ui/locales";

describe("locale preference", () => {
  it("prefers a supported saved language to the browser language", () => {
    expect(resolveLocale("pl", "en-US")).toBe("pl");
  });

  it("uses the browser's base language when there is no supported preference", () => {
    expect(resolveLocale(null, "pl-PL")).toBe("pl");
    expect(resolveLocale("unknown", "en-US")).toBe("en");
  });

  it("falls back to the default for unsupported browser languages", () => {
    expect(resolveLocale(null, "fr-FR")).toBe("en");
  });
});
