import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  CodeXml as Github,
  Download,
  ExternalLink,
  Server,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import MonqomLogo from "@/components/MonqomLogo";
import { HelpLink } from "@/components/layout/HelpLink";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Card, buttonVariants } from "@monqom/ui";

const githubUrl = "https://github.com/sergiusz-x/monqom";
const selfHostingUrl = `${githubUrl}/blob/main/docs/self-hosting.md`;
const primaryAction =
  "bg-emerald-800 text-white hover:bg-emerald-900 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200";

function SectionHeading({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", centered && "mx-auto text-center")}>
      <p className="text-sm font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-pretty text-lg leading-8 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage?.startsWith("pl") ? "pl" : "en";
  const screenshot = (name: string) =>
    `/marketing/screenshots/${locale}/${name}-${isDark ? "dark" : "light"}.png`;
  const previewLabels = (title: string) => ({
    openLabel: t("landing.preview.open", { title }),
    closeLabel: t("landing.preview.close"),
  });
  const controlCards = [
    {
      icon: Download,
      title: t("landing.control.export.title"),
      description: t("landing.control.export.description"),
    },
    {
      icon: ShieldCheck,
      title: t("landing.control.account.title"),
      description: t("landing.control.account.description"),
    },
    {
      icon: Smartphone,
      title: t("landing.control.mobile.title"),
      description: t("landing.control.mobile.description"),
    },
  ];

  return (
    <div className="w-full overflow-hidden">
      <section className="border-b border-border bg-emerald-50/40 dark:bg-emerald-950/20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:py-24">
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">
              {t("landing.eyebrow")}
            </p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {t("landing.title")}
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
              {t("landing.description")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2",
                  primaryAction,
                )}
              >
                {t("landing.createAccount")}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="#features"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "gap-2",
                )}
              >
                {t("landing.exploreFeatures")}
              </a>
            </div>
            <ul className="mt-9 space-y-3 text-sm text-muted-foreground">
              {[
                t("landing.proof.overview"),
                t("landing.proof.budget"),
                t("landing.proof.ownership"),
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check
                    size={16}
                    className="text-emerald-700 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative pb-4 pr-4 sm:pb-8 sm:pr-10">
            <ProductPreview
              src={screenshot("dashboard")}
              alt={t("landing.overview.imageAlt")}
              {...previewLabels(t("landing.featureCards.dashboard.title"))}
            />
            <div className="absolute bottom-0 right-0 hidden w-[26%] sm:block">
              <ProductPreview
                src={screenshot("mobile-dashboard")}
                alt={t("landing.mobileImageAlt")}
                {...previewLabels(t("landing.control.mobile.title"))}
                portrait
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16"
      >
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <SectionHeading
            eyebrow={t("landing.overview.eyebrow")}
            title={t("landing.overview.title")}
            description={t("landing.overview.description")}
          />
          <nav
            aria-label={t("landing.navigation.features")}
            className="grid border-t border-border"
          >
            {(["transactions", "budgets", "goals"] as const).map(
              (feature, index) => (
                <a
                  key={feature}
                  href={`#${feature}`}
                  className="group flex items-center gap-4 border-b border-border py-3 text-sm font-medium transition-colors hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 dark:hover:text-emerald-300"
                >
                  <span
                    aria-hidden="true"
                    className="text-xs tabular-nums text-muted-foreground"
                  >
                    0{index + 1}
                  </span>
                  <span className="flex-1">{t(`nav.${feature}`)}</span>
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="text-emerald-800 transition-transform motion-safe:group-hover:translate-x-1 dark:text-emerald-300"
                  />
                </a>
              ),
            )}
          </nav>
        </div>
      </section>

      <section
        id="transactions"
        className="scroll-mt-28 border-y border-border bg-muted/30"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
          <div className="order-2 lg:order-1">
            <ProductPreview
              src={screenshot("transactions")}
              alt={t("landing.transactions.imageAlt")}
              {...previewLabels(t("landing.transactions.title"))}
            />
          </div>
          <div className="lg:order-2">
            <SectionHeading
              eyebrow={t("landing.transactions.eyebrow")}
              title={t("landing.transactions.title")}
              description={t("landing.transactions.description")}
            />
          </div>
        </div>
      </section>

      <section
        id="budgets"
        className="mx-auto max-w-6xl scroll-mt-28 px-4 py-16 sm:px-6 lg:py-20"
      >
        <div className="grid gap-10 rounded-3xl border border-emerald-800/15 bg-emerald-50/40 p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center dark:border-emerald-300/25 dark:bg-emerald-950/20">
          <SectionHeading
            eyebrow={t("landing.budgets.eyebrow")}
            title={t("landing.budgets.title")}
            description={t("landing.budgets.description")}
          />
          <ProductPreview
            src={screenshot("budgets")}
            alt={t("landing.budgets.imageAlt")}
            {...previewLabels(t("landing.budgets.title"))}
          />
        </div>
      </section>

      <section
        id="goals"
        className="scroll-mt-28 border-y border-border bg-muted/30"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-20">
          <div className="lg:order-2">
            <SectionHeading
              eyebrow={t("landing.goals.eyebrow")}
              title={t("landing.goals.title")}
              description={t("landing.goals.description")}
            />
          </div>
          <div className="lg:order-1">
            <ProductPreview
              src={screenshot("goals")}
              alt={t("landing.goals.imageAlt")}
              {...previewLabels(t("landing.goals.title"))}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading
          eyebrow={t("landing.steps.eyebrow")}
          title={t("landing.steps.title")}
          centered
        />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {(["add", "review", "plan"] as const).map((step, index) => (
            <li key={step}>
              <Card
                padding="spacious"
                className="h-full border-t-2 border-t-emerald-700/40 dark:border-t-emerald-400/40"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  0{index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">
                  {t(`landing.steps.${step}.title`)}
                </h3>
                <p className="mt-2 leading-7 text-muted-foreground">
                  {t(`landing.steps.${step}.description`)}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section id="control" className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow={t("landing.control.eyebrow")}
            title={t("landing.control.title")}
            centered
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {controlCards.map(({ icon: Icon, title, description }) => (
                <Card key={title} padding="spacious">
                  <Icon
                    size={22}
                    className="text-emerald-800 dark:text-emerald-300"
                    aria-hidden="true"
                  />
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </Card>
              ))}
            </div>
            <div className="mx-auto w-full max-w-sm self-center">
              <ProductPreview
                src={screenshot("mobile-dashboard")}
                alt={t("landing.mobileImageAlt")}
                {...previewLabels(t("landing.control.mobile.title"))}
                portrait
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="self-hosting"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20"
      >
        <SectionHeading
          eyebrow={t("landing.selfHostingSection.eyebrow")}
          title={t("landing.selfHostingSection.title")}
          centered
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
          <Card padding="spacious">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MonqomLogo size={24} />
            </div>
            <h3 className="mt-6 text-xl font-semibold">
              {t("landing.selfHostingSection.hosted.title")}
            </h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              {t("landing.selfHostingSection.hosted.description")}
            </p>
            <Link
              to="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-7 gap-2",
                primaryAction,
              )}
            >
              {t("landing.selfHostingSection.hosted.action")}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </Card>
          <Card padding="spacious">
            <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
              <Server size={22} aria-hidden="true" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">
              {t("landing.selfHostingSection.selfHosted.title")}
            </h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              {t("landing.selfHostingSection.selfHosted.description")}
            </p>
            <a
              href={selfHostingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "mt-7 gap-2",
              )}
            >
              {t("landing.selfHostingSection.selfHosted.action")}
              <ExternalLink size={17} aria-hidden="true" />
            </a>
          </Card>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-20">
          <SectionHeading
            eyebrow={t("landing.faq.eyebrow")}
            title={t("landing.faq.title")}
          />
          <dl className="divide-y divide-border border-y border-border">
            {(["transactions", "data", "devices"] as const).map((item) => (
              <div key={item} className="py-6">
                <dt className="font-semibold">
                  {t(`landing.faq.${item}.question`)}
                </dt>
                <dd className="mt-2 leading-7 text-muted-foreground">
                  {t(`landing.faq.${item}.answer`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-28">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.finalCta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
            {t("landing.finalCta.description")}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "gap-2",
                primaryAction,
              )}
            >
              {t("landing.createAccount")}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "gap-2",
              )}
            >
              <Github size={17} aria-hidden="true" />
              {t("landing.viewOnGitHub")}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t("landing.footer.copyright")}</p>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2"
            aria-label={t("nav.main")}
          >
            <Link
              to="/privacy"
              className="hover:text-foreground hover:underline"
            >
              {t("auth.privacyNotice")}
            </Link>
            <Link to="/terms" className="hover:text-foreground hover:underline">
              {t("auth.terms")}
            </Link>
            <HelpLink className="hover:text-foreground hover:underline">
              {t("nav.help")}
            </HelpLink>
            <a
              href={
                locale === "pl"
                  ? "mailto:kontakt+monqom@sergiusz.dev"
                  : "mailto:contact+monqom@sergiusz.dev"
              }
              className="hover:text-foreground hover:underline"
            >
              {t("landing.footer.contact")}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
