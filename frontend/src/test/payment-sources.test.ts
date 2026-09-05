import { describe, expect, it } from "vitest";
import { paymentSourceLabels } from "@/lib/payment-sources";

describe("paymentSourceLabels", () => {
  it("uses translated names for system sources and preserves custom names", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(
      paymentSourceLabels(
        [
          { id: "cash", name: "Cash", systemKey: "cash" },
          { id: "bank", name: "Joint account", systemKey: null },
        ],
        translate,
      ),
    ).toEqual({
      cash: "translated:paymentSources.systemCash",
      bank: "Joint account",
    });
  });
});
