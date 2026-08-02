import { useState } from "react";
import { LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/useToast";
import { Button, Modal, PendingButton } from "@monqom/ui";

const themeOptions = [
  { mode: "system", label: "publicPreferences.system", icon: Monitor },
  { mode: "light", label: "publicPreferences.light", icon: Sun },
  { mode: "dark", label: "publicPreferences.dark", icon: Moon },
] as const;

export function MobileAccountMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { showToast } = useToast(6000);
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      setOpen(false);
    } catch {
      showToast(t("apiErrors.logoutFailed"), "error");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        aria-label={t("nav.account")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <UserRound size={18} aria-hidden="true" />
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={t("nav.account")}
        contentClassName="max-w-sm"
      >
        <h2 className="text-lg font-semibold">{t("nav.account")}</h2>
        {user ? (
          <div className="mt-4 rounded-lg bg-muted p-3">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        ) : null}
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">
            {t("publicPreferences.theme")}
          </legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {themeOptions.map(({ mode: optionMode, label, icon: Icon }) => (
              <Button
                key={optionMode}
                type="button"
                variant={mode === optionMode ? "secondary" : "outline"}
                className="h-auto min-h-11 flex-col gap-1 py-2 text-xs"
                aria-pressed={mode === optionMode}
                onClick={() => setMode(optionMode as ThemeMode)}
              >
                <Icon size={16} aria-hidden="true" />
                {t(label)}
              </Button>
            ))}
          </div>
        </fieldset>
        <PendingButton
          type="button"
          variant="outline"
          className="mt-5 w-full justify-center gap-2 text-destructive hover:text-destructive"
          onClick={() => void handleLogout()}
          isPending={isLoggingOut}
          pendingLabel={t("auth.loggingOut")}
        >
          <LogOut size={16} aria-hidden="true" />
          {t("nav.logout")}
        </PendingButton>
      </Modal>
    </>
  );
}
