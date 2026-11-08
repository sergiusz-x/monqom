import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@monqom/ui";
import { formatMonth, formatShortMonth } from "@/lib/date-only";

export function DashboardMonthPicker({
  month,
  currentMonth,
  onSelectMonth,
}: {
  month: string;
  currentMonth: string;
  onSelectMonth: (month: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const selectMonth = (value: string) => {
    onSelectMonth(value);
    setOpen(false);
  };
  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setYear(Number(month.slice(0, 4)));
        setOpen(nextOpen);
      }}
    >
      <Popover.Trigger
        className={buttonVariants({
          variant: "outline",
          className: "min-h-11 min-w-36 gap-2 sm:min-h-9",
        })}
        aria-label={t("dashboard.selectMonth", { month: formatMonth(month) })}
      >
        {formatMonth(month)} <ChevronDown size={15} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={6}
          align="center"
          className="z-[90] outline-none"
        >
          <Popover.Popup
            aria-label={t("dashboard.monthSelector")}
            className="w-[min(19rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none"
          >
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => setYear((value) => value - 1)}
                disabled={year <= 100}
                aria-label={t("dashboard.previousYear")}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <span className="font-semibold" aria-live="polite">
                {year}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={() => setYear((value) => value + 1)}
                disabled={year >= 9999}
                aria-label={t("dashboard.nextYear")}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, index) => {
                const value = `${year}-${String(index + 1).padStart(2, "0")}`;
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={value === month ? "secondary" : "ghost"}
                    className="min-h-11 capitalize"
                    aria-label={formatMonth(value)}
                    aria-pressed={value === month}
                    onClick={() => selectMonth(value)}
                  >
                    {formatShortMonth(value)}
                  </Button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => selectMonth(currentMonth)}
            >
              {t("dashboard.currentMonth")}
            </Button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
