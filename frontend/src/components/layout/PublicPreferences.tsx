import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Monitor, Moon, Sun, Settings2 } from "lucide-react";
import i18n from "@/i18n";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";

import { cn } from "@/lib/utils";
import { Button } from "@monqom/ui";
import { defaultLocale, locales } from "@monqom/ui/locales";

const themeOptions = [
  { mode: "system", label: "publicPreferences.system", icon: Monitor },
  { mode: "light", label: "publicPreferences.light", icon: Sun },
  { mode: "dark", label: "publicPreferences.dark", icon: Moon },
] as const;

interface PublicPreferencesProps {
  className?: string;
  collapsible?: boolean;
}

export default function PublicPreferences({
  className,
  collapsible = false,
}: PublicPreferencesProps) {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      {collapsible && (
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          size="icon"
          className="size-11 sm:hidden"
          aria-label={t("publicPreferences.title")}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Settings2 size={18} aria-hidden="true" />
        </Button>
      )}
      <div
        className={cn(
          "flex h-11 items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm",
          collapsible &&
            "absolute right-0 top-full z-50 mt-2 sm:static sm:mt-0",
          collapsible && !open && "hidden sm:flex",
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
            void i18n.changeLanguage(
              Object.keys(locales)[
                (Object.keys(locales).indexOf(
                  i18n.resolvedLanguage ?? defaultLocale,
                ) +
                  1) %
                  Object.keys(locales).length
              ] ?? defaultLocale,
            )
          }
        >
          <Languages size={16} aria-hidden="true" />
          <span className="w-5 text-center text-xs">
            {(i18n.resolvedLanguage ?? defaultLocale).toUpperCase()}
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
    </div>
  );
}
