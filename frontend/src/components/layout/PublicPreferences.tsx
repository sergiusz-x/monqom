import { useTranslation } from "react-i18next";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import i18n from "@/i18n";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const themeOptions = [
  { mode: "system", label: "publicPreferences.system", icon: Monitor },
  { mode: "light", label: "publicPreferences.light", icon: Sun },
  { mode: "dark", label: "publicPreferences.dark", icon: Moon },
] as const;

interface PublicPreferencesProps {
  className?: string;
}

export default function PublicPreferences({
  className,
}: PublicPreferencesProps) {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  return (
    <div
      className={cn(
        "flex h-11 items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur",
        className,
      )}
      aria-label={t("publicPreferences.title")}
    >
      <Button
        type="button"
        variant="ghost"
        className="h-9 w-16 gap-1.5 px-2 font-semibold"
        aria-label={t("publicPreferences.changeLanguage")}
        title={t("publicPreferences.changeLanguage")}
        onClick={() =>
          void i18n.changeLanguage(i18n.resolvedLanguage === "pl" ? "en" : "pl")
        }
      >
        <Languages size={16} aria-hidden="true" />
        <span className="w-5 text-center text-xs">
          {i18n.resolvedLanguage === "pl" ? "PL" : "EN"}
        </span>
      </Button>

      <div className="h-5 w-px bg-border" aria-hidden="true" />

      <div
        className="flex items-center"
        aria-label={t("publicPreferences.theme")}
      >
        {themeOptions.map(({ mode: optionMode, label, icon: Icon }) => (
          <Button
            key={optionMode}
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-9",
              mode === optionMode && "bg-muted text-foreground",
            )}
            aria-label={t(label)}
            aria-pressed={mode === optionMode}
            title={t(label)}
            onClick={() => setMode(optionMode as ThemeMode)}
          >
            <Icon size={16} aria-hidden="true" />
          </Button>
        ))}
      </div>
    </div>
  );
}
