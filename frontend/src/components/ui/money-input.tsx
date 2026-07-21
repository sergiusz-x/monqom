import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { digitsToMinorUnits, formatMinorUnits } from "@/lib/money";
import { useTranslation } from "react-i18next";

interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> {
  currency: string;
  minorUnits: number | null;
  onMinorUnitsChange: (minorUnits: number | null) => void;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      currency,
      minorUnits,
      onMinorUnitsChange,
      className,
      placeholder,
      ...props
    },
    ref,
  ) {
    const { t } = useTranslation();
    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className={cn("pr-16 tabular-nums", className)}
          value={formatMinorUnits(minorUnits)}
          placeholder={placeholder ?? formatMinorUnits(0)}
          onChange={(event) =>
            onMinorUnitsChange(digitsToMinorUnits(event.target.value))
          }
          {...props}
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground"
          aria-label={t("common.currencyCode", { currency })}
        >
          {currency}
        </span>
      </div>
    );
  },
);
