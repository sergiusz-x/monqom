import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

describe("form field primitives", () => {
  it("associates label, hint and error with the control", () => {
    render(
      <FormField
        id="account-name"
        label="Account name"
        hint="Shown in transaction forms"
        error="Name is required"
        required
      >
        <Input />
      </FormField>,
    );

    const input = screen.getByRole("textbox", { name: "Account name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "account-name-hint account-name-error",
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      "account-name-error",
    );
  });

  it("provides consistent select, textarea and money controls", () => {
    render(
      <>
        <FormField id="currency" label="Currency">
          <Select>
            <option>PLN</option>
          </Select>
        </FormField>
        <FormField id="notes" label="Notes">
          <Textarea />
        </FormField>
        <FormField id="amount" label="Amount">
          <MoneyInput
            currency="PLN"
            minorUnits={null}
            onMinorUnitsChange={() => undefined}
          />
        </FormField>
      </>,
    );

    expect(
      screen.getByRole("combobox", { name: "Currency" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    expect(screen.getAllByText("PLN")).toHaveLength(2);
  });
});
