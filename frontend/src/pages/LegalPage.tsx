import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import MonqomLogo from "@/components/MonqomLogo";
import PublicPreferences from "@/components/layout/PublicPreferences";
import { legalCopy } from "@/i18n/resources/legal";

export default function LegalPage({
  document,
}: {
  document: "privacy" | "terms";
}) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage?.startsWith("pl") ? "pl" : "en";
  const content = legalCopy[locale];
  const page = content[document];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <MonqomLogo size={28} /> Monqom
          </Link>
          <PublicPreferences collapsible />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← {content.back}
        </Link>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          {content.scope}
        </p>
        <nav
          className="mt-8 flex flex-wrap gap-5 text-sm"
          aria-label={content.navigation}
        >
          <Link
            to="/privacy"
            aria-current={document === "privacy" ? "page" : undefined}
            className="text-muted-foreground hover:text-foreground hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          >
            {content.privacy.title}
          </Link>
          <Link
            to="/terms"
            aria-current={document === "terms" ? "page" : undefined}
            className="text-muted-foreground hover:text-foreground hover:underline aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          >
            {content.terms.title}
          </Link>
        </nav>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
          {page.title}
        </h1>
        <div className="mt-8 space-y-8">
          {page.sections.map(([heading, body]) => (
            <section key={heading} className="space-y-2">
              <h2 className="text-lg font-semibold">{heading}</h2>
              <p className="leading-7 text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
        <a
          href={
            locale === "pl"
              ? "mailto:kontakt+monqom@sergiusz.dev"
              : "mailto:contact+monqom@sergiusz.dev"
          }
          className="mt-10 inline-block text-sm font-medium text-primary hover:underline"
        >
          {content.contact}
        </a>
      </main>
    </div>
  );
}
