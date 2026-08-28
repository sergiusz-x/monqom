import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Check,
  CodeXml as Github,
  Download,
  ExternalLink,
  LayoutDashboard,
  PiggyBank,
  Server,
  ShieldCheck,
  Smartphone,
  Tags,
} from "lucide-react";
import MonqomLogo from "@/components/MonqomLogo";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { cn } from "@/lib/utils";
import { Card, buttonVariants } from "@monqom/ui";

const githubUrl = "https://github.com/sergiusz-x/monqom";
const selfHostingUrl = `${githubUrl}/blob/main/docs/self-hosting.md`;
const securityUrl = `${githubUrl}/blob/main/SECURITY.md`;
const licenseUrl = `${githubUrl}/blob/main/LICENSE`;

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
      <p className="text-sm font-semibold tracking-wide text-primary">
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
  const { t } = useTranslation();
  const featureCards = [
    {
      icon: LayoutDashboard,
      title: t("landing.featureCards.dashboard.title"),
      description: t("landing.featureCards.dashboard.description"),
    },
    {
      icon: Tags,
      title: t("landing.featureCards.organization.title"),
      description: t("landing.featureCards.organization.description"),
    },
    {
      icon: PiggyBank,
      title: t("landing.featureCards.budgets.title"),
      description: t("landing.featureCards.budgets.description"),
    },
  ];
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
      <section className="relative isolate border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_13%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_31%),radial-gradient(circle_at_18%_8%,color-mix(in_oklab,var(--chart-2)_13%,transparent),transparent_23%)]" />
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:py-24">
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-wide text-primary">
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
                className={cn(buttonVariants({ size: "lg" }), "gap-2")}
              >
                {t("landing.createAccount")}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href={selfHostingUrl}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "gap-2",
                )}
              >
                <Server size={17} aria-hidden="true" />
                {t("landing.selfHost")}
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
                    className="text-primary"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview
            src="/marketing/screenshots/dashboard-dark.png"
            alt={t("landing.heroImageAlt")}
            openLabel={t("landing.preview.open", {
              title: t("landing.heroImageAlt"),
            })}
            closeLabel={t("landing.preview.close")}
            className="mx-auto max-w-3xl lg:translate-x-10"
          />
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
      >
        <SectionHeading
          eyebrow={t("landing.overview.eyebrow")}
          title={t("landing.overview.title")}
          description={t("landing.overview.description")}
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {featureCards.map(({ icon: Icon, title, description }) => (
            <Card key={title} padding="spacious">
              <Icon size={22} className="text-primary" aria-hidden="true" />
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 leading-7 text-muted-foreground">
                {description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
          <div className="order-2 lg:order-1">
            <ProductPreview
              src="/marketing/screenshots/transactions-dark.png"
              alt={t("landing.transactions.imageAlt")}
              openLabel={t("landing.preview.open", {
                title: t("landing.transactions.imageAlt"),
              })}
              closeLabel={t("landing.preview.close")}
            />
          </div>
          <SectionHeading
            eyebrow={t("landing.transactions.eyebrow")}
            title={t("landing.transactions.title")}
            description={t("landing.transactions.description")}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
        <SectionHeading
          eyebrow={t("landing.budgets.eyebrow")}
          title={t("landing.budgets.title")}
          description={t("landing.budgets.description")}
        />
        <ProductPreview
          src="/marketing/screenshots/budgets-dark.png"
          alt={t("landing.budgets.imageAlt")}
          openLabel={t("landing.preview.open", {
            title: t("landing.budgets.imageAlt"),
          })}
          closeLabel={t("landing.preview.close")}
        />
      </section>

      <section id="control" className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <SectionHeading
            eyebrow={t("landing.control.eyebrow")}
            title={t("landing.control.title")}
            centered
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {controlCards.map(({ icon: Icon, title, description }) => (
                <Card key={title} padding="spacious">
                  <Icon size={22} className="text-primary" aria-hidden="true" />
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </Card>
              ))}
            </div>
            <div className="mx-auto w-full max-w-sm self-center">
              <ProductPreview
                src="/marketing/screenshots/mobile-dashboard-dark.png"
                alt={t("landing.control.imageAlt")}
                openLabel={t("landing.preview.open", {
                  title: t("landing.control.imageAlt"),
                })}
                closeLabel={t("landing.preview.close")}
                portrait
                className="mx-auto max-w-[22rem]"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="self-hosting"
        className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
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
              className={cn(buttonVariants({ size: "lg" }), "mt-7 gap-2")}
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
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              {t("landing.createAccount")}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={githubUrl}
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
            <a
              href={githubUrl}
              className="hover:text-foreground hover:underline"
            >
              {t("landing.footer.source")}
            </a>
            <a
              href={selfHostingUrl}
              className="hover:text-foreground hover:underline"
            >
              {t("landing.footer.selfHosting")}
            </a>
            <a
              href={securityUrl}
              className="hover:text-foreground hover:underline"
            >
              {t("landing.footer.security")}
            </a>
            <a
              href={licenseUrl}
              className="hover:text-foreground hover:underline"
            >
              {t("landing.footer.license")}
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
