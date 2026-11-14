import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { resolveLocale } from "@monqom/ui/locales";
import type { ReactNode } from "react";

export function HelpLink({
  article,
  children,
  className,
  newTab = false,
}: {
  article?: string;
  children: ReactNode;
  className?: string;
  newTab?: boolean;
}) {
  const { i18n } = useTranslation();
  const locale = resolveLocale(
    i18n.resolvedLanguage ?? null,
    navigator.language,
  );
  return (
    <Link
      to={`/help/${locale}/${article ? `${article}/` : ""}`}
      className={className}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
    >
      {children}
    </Link>
  );
}
