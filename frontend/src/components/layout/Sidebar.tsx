import { Link, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  WalletCards,
  Settings,
  Plus,
  Monitor,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import MonqomLogo from "@/components/MonqomLogo";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { PendingButton } from "@/components/ui/pending-button";
import type { AppTranslationKey } from "@/i18n";

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
    label: "paymentSources.title",
    icon: WalletCards,
    end: false,
  },
  { to: "/settings", label: "nav.settings", icon: Settings, end: false },
] as const;

const themeOptions: Record<
  ThemeMode,
  {
    next: ThemeMode;
    label: AppTranslationKey;
    icon: typeof Monitor;
  }
> = {
  system: {
    next: "light",
    label: "publicPreferences.system",
    icon: Monitor,
  },
  light: {
    next: "dark",
    label: "publicPreferences.light",
    icon: Sun,
  },
  dark: {
    next: "system",
    label: "publicPreferences.dark",
    icon: Moon,
  },
};

interface SidebarProps {
  onAddTransaction: () => void;
}

export default function Sidebar({ onAddTransaction }: SidebarProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const currentTheme = themeOptions[mode];
  const ThemeIcon = currentTheme.icon;
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { showToast } = useToast(6000);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      showToast(t("apiErrors.logoutFailed"), "error");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <aside
      className="w-56 shrink-0 border-r border-border flex flex-col bg-sidebar"
      aria-label={t("nav.main")}
    >
      <Link
        to="/dashboard"
        className="flex h-14 items-center gap-2 border-b border-border px-4 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={t("nav.goToDashboard")}
      >
        <MonqomLogo size={22} />
        <span className="text-lg font-semibold tracking-tight">Monqom</span>
      </Link>

      <WorkspaceSwitcher className="mx-3 mt-3 text-sidebar-foreground" />

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )
            }
          >
            <Icon size={16} aria-hidden="true" />
            {t(label)}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-3">
        <Button
          variant="default"
          className="w-full gap-2"
          onClick={onAddTransaction}
        >
          <Plus size={16} aria-hidden="true" />
          {t("nav.addTransaction")}
        </Button>

        <div className="border-t border-border pt-3">
          {user && (
            <div className="px-1 mb-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={t("publicPreferences.cycleTheme", {
                theme: t(currentTheme.label),
              })}
              title={t(currentTheme.label)}
              onClick={() => setMode(currentTheme.next)}
            >
              <ThemeIcon size={16} aria-hidden="true" />
            </Button>
            <PendingButton
              variant="ghost"
              size="sm"
              onClick={() => void handleLogout()}
              isPending={isLoggingOut}
              pendingLabel={t("auth.loggingOut")}
              className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut size={16} aria-hidden="true" />
              {t("nav.logout")}
            </PendingButton>
          </div>
        </div>
      </div>
    </aside>
  );
}
