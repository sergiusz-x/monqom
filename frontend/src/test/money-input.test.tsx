import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/i18n";
import { MoneyInput } from "@/components/ui/money-input";
import {
  digitsToMinorUnits,
  formatMinorUnits,
  majorAmountToMinorUnits,
  minorUnitsToMajorAmount,
} from "@/lib/money";

function ControlledMoneyInput() {
  const [minorUnits, setMinorUnits] = useState<number | null>(null);
  return (
    <MoneyInput
      aria-label="Amount"
      currency="PLN"
      minorUnits={minorUnits}
      onMinorUnitsChange={setMinorUnits}
    />
  );
}

describe("MoneyInput", () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage("en");
  });

  it("uses one minor-unit editing model and locale formatting", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    render(<ControlledMoneyInput />);
    const input = screen.getByRole("textbox", { name: "Amount" });

    await user.type(input, "12000");

    expect(input).toHaveValue("120.00");
    expect(screen.getByLabelText("Currency: PLN")).toBeVisible();
  });

  it("localizes the visible currency description", async () => {
    await i18n.changeLanguage("pl");
    render(<ControlledMoneyInput />);

    expect(screen.getByLabelText("Waluta: PLN")).toBeVisible();
  });

  it("converts decimal API values without multiplying floating point values", () => {
    expect(majorAmountToMinorUnits(0.29)).toBe(29);
    expect(majorAmountToMinorUnits("90071992547409.91")).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(majorAmountToMinorUnits("1.999")).toBeNull();
    expect(minorUnitsToMajorAmount(29)).toBe(0.29);
    expect(minorUnitsToMajorAmount(-29)).toBe(-0.29);
    expect(digitsToMinorUnits("1 234,56")).toBe(123456);
  });

  it("formats the same minor units according to locale", () => {
    expect(formatMinorUnits(123456, "en-US")).toBe("1,234.56");
    expect(formatMinorUnits(123456, "pl-PL")).toMatch(/^1[\s\u00a0]234,56$/);
  });
});
