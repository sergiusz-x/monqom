import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { getApiErrorMessage } from "@/lib/api-errors";

describe("getApiErrorMessage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl");
  });

  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("translates stable API codes instead of exposing the server message", () => {
    expect(
      getApiErrorMessage({
        response: {
          status: 401,
          data: { code: "INVALID_CREDENTIALS", message: "raw backend text" },
        },
      }),
    ).toBe("Nieprawidłowy adres e-mail lub hasło.");
  });

  it("uses a translated status fallback for an unknown code", () => {
    expect(
      getApiErrorMessage({
        response: { status: 429, data: { code: "NEW_SERVER_CODE" } },
      }),
    ).toBe("Zbyt wiele prób. Spróbuj ponownie później.");
  });

  it("distinguishes connection failures from unknown client errors", () => {
    expect(getApiErrorMessage({ request: {} })).toBe(
      "Nie udało się połączyć z serwerem. Sprawdź połączenie.",
    );
    expect(getApiErrorMessage(new Error("secret detail"))).toBe(
      "Wystąpił błąd. Spróbuj ponownie.",
    );
  });
});
