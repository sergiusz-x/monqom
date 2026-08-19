import { NavLink, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Target,
  WalletCards,
  Settings,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@monqom/ui";

const navItems = [
  {
    to: "/dashboard",
    label: "nav.dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  { to: "/transactions", label: "nav.transactions", icon: Receipt, end: false },
  { to: "/budgets", label: "nav.budgets", icon: PiggyBank, end: false },
  { to: "/goals", label: "nav.goals", icon: Target, end: false },
] as const;

interface BottomNavProps {
  onAddTransaction: () => void;
}

export default function BottomNav({ onAddTransaction }: BottomNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive =
    location.pathname.startsWith("/payment-sources") ||
    location.pathname.startsWith("/settings");

  function go(to: string) {
    setMoreOpen(false);
    navigate(to);
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-start border-t border-border bg-background pt-1 md:hidden"
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
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] sm:text-xs",
            moreActive ? "text-foreground" : "text-muted-foreground",
          )}
          aria-label={t("nav.more")}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          <span className="max-w-full truncate">{t("nav.more")}</span>
        </button>
      </nav>

      <Button
        type="button"
        onClick={onAddTransaction}
        aria-label={t("nav.addTransaction")}
        size="icon"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
      >
        <Plus size={24} aria-hidden="true" />
      </Button>
      <Modal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        ariaLabelledBy="mobile-more-title"
        contentClassName="max-w-sm"
      >
        <h2 id="mobile-more-title" className="text-lg font-semibold">
          {t("nav.more")}
        </h2>
        <div className="mt-4 grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3"
            onClick={() => go("/payment-sources")}
          >
            <WalletCards aria-hidden="true" />
            {t("paymentSources.title")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3"
            onClick={() => go("/settings")}
          >
            <Settings aria-hidden="true" />
            {t("nav.settings")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
