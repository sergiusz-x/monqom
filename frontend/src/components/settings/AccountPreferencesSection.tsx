import { useState } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/useToast";
import { Button, PendingButton } from "@monqom/ui";

const themeOptions = [
  { mode: "system", label: "publicPreferences.system", icon: Monitor },
  { mode: "light", label: "publicPreferences.light", icon: Sun },
  { mode: "dark", label: "publicPreferences.dark", icon: Moon },
] as const;

export function AccountPreferencesSection() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { showToast } = useToast(6000);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{t("settings.account")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings.accountDescription")}
      </p>

      {user ? (
        <div className="mt-5 rounded-lg bg-muted p-3">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
      ) : null}

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">
          {t("settings.appearance")}
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {themeOptions.map(({ mode: optionMode, label, icon: Icon }) => (
            <Button
              key={optionMode}
              type="button"
              variant={mode === optionMode ? "secondary" : "outline"}
              className="h-auto min-h-11 flex-col gap-1 py-2 text-xs sm:text-sm"
              aria-pressed={mode === optionMode}
              onClick={() => setMode(optionMode)}
            >
              <Icon size={16} aria-hidden="true" />
              {t(label)}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-medium">{t("settings.signOut")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.signOutDescription")}
        </p>
        <PendingButton
          type="button"
          variant="outline"
          className="mt-3 w-full justify-center gap-2 text-destructive hover:text-destructive sm:w-auto"
          onClick={() => void handleLogout()}
          isPending={isLoggingOut}
          pendingLabel={t("auth.loggingOut")}
        >
          <LogOut size={16} aria-hidden="true" />
          {t("nav.logout")}
        </PendingButton>
      </div>
    </section>
  );
}
