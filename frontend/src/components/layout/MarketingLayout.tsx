import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import MonqomLogo from "@/components/MonqomLogo";
import PublicPreferences from "./PublicPreferences";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@monqom/ui";

export default function MarketingLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MonqomLogo size={28} className="text-foreground" />
            <span className="text-lg font-semibold tracking-tight">Monqom</span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-4 text-sm text-muted-foreground lg:flex" aria-label={t("nav.main")}>
              <a href="#features" className="hover:text-foreground">{t("landing.navigation.features")}</a>
              <a href="#control" className="hover:text-foreground">{t("landing.navigation.control")}</a>
              <a href="#self-hosting" className="hover:text-foreground">{t("landing.navigation.selfHosting")}</a>
            </nav>
            <Link to="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
              {t("landing.signIn")}
            </Link>
            <Link to="/register" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
              {t("landing.createAccount")}
            </Link>
            <PublicPreferences />
          </div>
        </div>
      </header>
      <main className="flex flex-1">
        <Outlet />
      </main>
    </div>
  );
}
