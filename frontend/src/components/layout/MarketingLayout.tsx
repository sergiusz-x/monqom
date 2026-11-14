import { Link, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { HelpLink } from "./HelpLink";
import MonqomLogo from "@/components/MonqomLogo";
import PublicPreferences from "./PublicPreferences";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@monqom/ui";

export default function MarketingLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MonqomLogo size={28} className="text-foreground" />
            <span className="hidden text-lg font-semibold tracking-tight sm:inline">Monqom</span>
          </Link>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <nav
              className="hidden items-center gap-4 text-sm text-muted-foreground lg:flex"
              aria-label={t("nav.main")}
            >
              <a href="#features" className="hover:text-foreground">
                {t("landing.navigation.features")}
              </a>
              <a href="#control" className="hover:text-foreground">
                {t("landing.navigation.control")}
              </a>
              <a href="#self-hosting" className="hover:text-foreground">
                {t("landing.navigation.selfHosting")}
              </a>
            </nav>
            <HelpLink className="hidden rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground sm:block">
              {t("nav.help")}
            </HelpLink>
            <Link
              to="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "inline-flex",
              )}
            >
              {t("landing.signIn")}
            </Link>
            <Link
              to="/register"
              className={cn(
                buttonVariants({ size: "sm" }),
                "inline-flex bg-emerald-800 text-white hover:bg-emerald-900 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200",
              )}
            >
              {t("landing.createAccount")}
            </Link>
            <PublicPreferences collapsible />
          </div>
        </div>
      </header>
      <main className="flex flex-1">
        <Outlet />
      </main>
    </div>
  );
}
