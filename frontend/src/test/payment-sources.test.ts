import { describe, expect, it } from "vitest";
import { paymentSourceLabels } from "@/lib/payment-sources";
import type { TFunction } from "i18next";

describe("paymentSourceLabels", () => {
  it("uses translated names for system sources and preserves custom names", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(
      paymentSourceLabels(
        [
          { id: "cash", name: "Cash", systemKey: "cash" },
          { id: "bank", name: "Joint account", systemKey: null },
        ],
        translate as unknown as TFunction,
      ),
    ).toEqual({
      cash: "translated:paymentSources.systemCash",
      bank: "Joint account",
    });
  });
});
