import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  WalletCards,
  Settings,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    to: "/dashboard",
    label: "nav.dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  { to: "/transactions", label: "nav.transactions", icon: Receipt, end: false },
  { to: "/budgets", label: "nav.budgets", icon: PiggyBank, end: false },
  {
    to: "/payment-sources",
    label: "paymentSources.shortTitle",
    icon: WalletCards,
    end: false,
  },
  { to: "/settings", label: "nav.settings", icon: Settings, end: false },
] as const;

interface BottomNavProps {
  onAddTransaction: () => void;
}

export default function BottomNav({ onAddTransaction }: BottomNavProps) {
  const { t } = useTranslation();

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-border bg-background md:hidden"
        aria-label={t("nav.mobile")}
      >
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] sm:text-xs",
                isActive ? "text-foreground" : "text-muted-foreground",
              )
            }
          >
            <Icon size={20} aria-hidden="true" />
            <span className="max-w-full truncate">{t(label)}</span>
          </NavLink>
        ))}
      </nav>

      <Button
        type="button"
        onClick={onAddTransaction}
        aria-label={t("nav.addTransaction")}
        size="icon"
        className="fixed bottom-20 right-4 z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
      >
        <Plus size={24} aria-hidden="true" />
      </Button>
    </>
  );
}
