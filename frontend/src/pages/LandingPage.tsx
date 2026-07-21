import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MonqomLogo from "@/components/MonqomLogo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="flex max-w-2xl flex-col items-center text-center">
        <MonqomLogo size={64} className="mb-8 text-foreground" />
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
          {t("landing.description")}
        </h1>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/login"
            className={cn(buttonVariants({ size: "lg" }), "min-w-32")}
          >
            {t("landing.signIn")}
          </Link>
          <Link
            to="/register"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-w-32",
            )}
          >
            {t("landing.createAccount")}
          </Link>
        </div>
      </div>
    </section>
  );
}
