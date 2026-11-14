import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
} from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, Search } from "lucide-react";
import { micromark } from "micromark";
import { Button } from "@monqom/ui";
import { locales, resolveLocale, type Locale } from "@monqom/ui/locales";
import MonqomLogo from "@/components/MonqomLogo";
import { ScreenshotDialog } from "@/components/ScreenshotDialog";
import PublicPreferences from "@/components/layout/PublicPreferences";
import { useTheme } from "@/contexts/ThemeContext";

const files = import.meta.glob<string>("../help/content/*/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

const articles = Object.entries(files)
  .map(([path, source]) => {
    const [, locale, slug] = path.match(/\/([^/]+)\/([^/]+)\.md$/) ?? [];
    const title = source.match(/^title:\s*(.+)$/m)?.[1] ?? slug;
    const body = source.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
    const order = Number(source.match(/^\s+order:\s*(\d+)/m)?.[1] ?? 999);
    const category = source.match(/^category:\s*(.+)$/m)?.[1];
    const subcategory = source.match(/^subcategory:\s*(.+)$/m)?.[1];
    const related =
      source
        .match(/^related:\s*(.+)$/m)?.[1]
        ?.split(",")
        .map((value) => value.trim()) ?? [];
    const updated = source.match(/^updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];
    const text =
      new DOMParser().parseFromString(
        micromark(body).replace(/<\/(?:p|li|h[1-6]|div|blockquote)>/g, "$& "),
        "text/html",
      ).body.textContent ?? "";
    return {
      locale,
      slug,
      title,
      body,
      order,
      category,
      subcategory,
      text,
      related,
      updated,
    };
  })
  .sort((a, b) => a.order - b.order);
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");

export default function HelpPage() {
  const { locale: routeLocale, article: routeArticle } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (
      previousPath.current !== location.pathname &&
      navigationType === "PUSH"
    ) {
      window.scrollTo(0, 0);
    }
    previousPath.current = location.pathname;
  }, [location.pathname, navigationType]);
  const { isDark } = useTheme();
  const [query, setQuery] = useState("");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const handleArticleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest("a");
    const image = link?.querySelector("img");
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    if (image && link.href === image.src) {
      event.preventDefault();
      setPreview({ src: image.src, alt: image.alt });
      return;
    }
    const url = new URL(link.href);
    if (
      url.origin === window.location.origin &&
      /^\/help(?:\/|$)/.test(url.pathname)
    ) {
      event.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    }
  };
  const locale =
    routeLocale && Object.hasOwn(locales, routeLocale)
      ? (routeLocale as Locale)
      : resolveLocale(i18n.resolvedLanguage ?? null, navigator.language);
  const slug = routeArticle ?? "index";

  useEffect(() => {
    if (
      routeLocale &&
      Object.hasOwn(locales, routeLocale) &&
      i18n.resolvedLanguage !== routeLocale
    ) {
      void i18n.changeLanguage(routeLocale);
    }
  }, [routeLocale, i18n]);

  useEffect(() => {
    const onLanguageChanged = (language: string) => {
      const next = resolveLocale(language, navigator.language);
      navigate(`/help/${next}/${slug === "index" ? "" : `${slug}/`}`, {
        replace: true,
      });
    };
    i18n.on("languageChanged", onLanguageChanged);
    return () => {
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, [i18n, navigate, slug]);

  const available = articles.filter((item) => item.locale === locale);
  const article = available.find((item) => item.slug === slug);
  const term = normalize(query.trim());
  const results = term
    ? available
        .filter((item) =>
          normalize(
            `${item.title} ${item.category ?? ""} ${item.subcategory ?? ""} ${item.text}`,
          ).includes(term),
        )
        .sort((a, b) => {
          const score = (item: typeof a) =>
            normalize(item.title ?? "").includes(term)
              ? 2
              : normalize(
                    `${item.category ?? ""} ${item.subcategory ?? ""}`,
                  ).includes(term)
                ? 1
                : 0;
          return score(b) - score(a) || a.order - b.order;
        })
    : [];
  const groups = available
    .filter((item) => item.slug !== "index")
    .reduce((groups, item) => {
      const category = item.category ?? t("help.other");
      const items = groups.get(category) ?? [];
      items.push(item);
      groups.set(category, items);
      return groups;
    }, new Map<string, typeof available>());
  const snippet = (text: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    const position = normalize(clean).indexOf(normalize(query.trim()));
    const start = Math.max(0, position - 65);
    const end = Math.min(clean.length, start + 170);
    return `${start ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
  };
  const articleBody = article?.body;
  const { renderedHtml, contents } = (() => {
    const html = articleBody
      ? micromark(
          articleBody.replace(
            /(\/marketing\/screenshots\/[^/]+\/[^)\s]+)-(?:light|dark)(\.png)/g,
            `$1-${isDark ? "dark" : "light"}$2`,
          ),
        )
      : "";
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const headings = Array.from(parsed.querySelectorAll("h2"));
    const contents =
      headings.length >= 4
        ? headings.map((heading, index) => {
            const id = `section-${index + 1}`;
            heading.id = id;
            return { id, title: heading.textContent ?? "" };
          })
        : [];
    return { renderedHtml: parsed.body.innerHTML, contents };
  })();
  const related =
    article?.related.flatMap((slug) => {
      const match = available.find(
        (item) => item.slug === slug && item.slug !== article.slug,
      );
      return match ? [match] : [];
    }) ?? [];
  const contact = (
    <a
      className="font-medium underline underline-offset-4 hover:text-foreground"
      href={
        locale === "pl"
          ? "mailto:kontakt+monqom@sergiusz.dev"
          : "mailto:contact+monqom@sergiusz.dev"
      }
    >
      {t("help.contactLink")}
    </a>
  );

  if (!routeLocale) return <Navigate to={`/help/${locale}/`} replace />;
  if (!Object.hasOwn(locales, routeLocale))
    return <Navigate to={`/help/${locale}/`} replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MonqomLogo size={28} /> <span>Monqom</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("help.backToApp")}
            </Link>
            <PublicPreferences collapsible />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("help.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("help.description")}</p>
          <div className="relative mt-6">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("help.searchPlaceholder")}
              aria-label={t("help.searchPlaceholder")}
              className="h-12 w-full rounded-xl border border-input bg-card pl-12 pr-4 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        {query.trim() ? (
          <section aria-live="polite" className="max-w-2xl space-y-3">
            <h2 className="font-semibold">{t("help.results")}</h2>
            {results.length ? (
              results.map((item) => (
                <Link
                  key={item.slug}
                  onClick={() => setQuery("")}
                  to={`/help/${locale}/${item.slug === "index" ? "" : `${item.slug}/`}`}
                  className="block rounded-xl border border-border bg-card p-4 hover:bg-muted"
                >
                  <span className="block font-medium">{item.title}</span>
                  {item.category && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {[item.category, item.subcategory]
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  )}
                  <span className="mt-2 block text-sm text-muted-foreground">
                    {snippet(item.text)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground">
                {t("help.noResults")} {contact}
              </p>
            )}
          </section>
        ) : (
          <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-12">
            <div>
              <Button
                type="button"
                variant="outline"
                aria-expanded={navigationOpen}
                aria-controls="help-navigation"
                onClick={() => setNavigationOpen((open) => !open)}
                className="h-12 w-full justify-between rounded-xl bg-card px-4 md:hidden"
              >
                <span>{t("help.articles")}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform ${navigationOpen ? "rotate-180" : ""}`}
                />
              </Button>
              <nav
                id="help-navigation"
                aria-label={t("help.articles")}
                onClick={(event) => {
                  if (
                    event.target instanceof Element &&
                    event.target.closest("a")
                  )
                    setNavigationOpen(false);
                }}
                className={`${navigationOpen ? "flex" : "hidden"} flex-col gap-1 pt-2 md:flex md:pt-0`}
              >
                {available
                  .filter((item) => item.slug === "index")
                  .map((item) => (
                    <Link
                      key={item.slug}
                      to={`/help/${locale}/`}
                      aria-current={item.slug === slug ? "page" : undefined}
                      className={`rounded-lg px-3 py-2 text-sm hover:bg-muted ${item.slug === slug ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {item.title}
                    </Link>
                  ))}
                {[...groups].map(([category, items]) => (
                  <div key={category} className="mt-5">
                    <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                    </h2>
                    <div className="ml-3 mt-2 space-y-1 border-l border-border pl-3">
                      {items.map((item, index) => (
                        <div key={item.slug}>
                          {item.subcategory &&
                            (index === 0 ||
                              items[index - 1]?.subcategory !==
                                item.subcategory) && (
                              <h3 className="mt-3 px-3 text-xs font-semibold text-muted-foreground">
                                {item.subcategory}
                              </h3>
                            )}
                          <Link
                            to={`/help/${locale}/${item.slug}/`}
                            aria-current={
                              item.slug === slug ? "page" : undefined
                            }
                            className={`block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-foreground ${item.subcategory ? "pl-5" : ""} ${item.slug === slug ? "bg-muted font-semibold text-foreground" : "text-foreground/80"}`}
                          >
                            {item.title}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
            <main className="min-w-0 max-w-3xl">
              {article ? (
                <>
                  <h2 className="mb-6 text-2xl font-semibold tracking-tight">
                    {article.title}
                  </h2>
                  {article.updated && (
                    <p className="mb-6 text-sm text-muted-foreground">
                      {t("help.updated")}{" "}
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "long",
                        timeZone: "UTC",
                      }).format(new Date(`${article.updated}T00:00:00Z`))}
                    </p>
                  )}
                  {contents.length > 0 && (
                    <nav
                      aria-label={t("help.contents")}
                      className="mb-8 rounded-xl border border-border bg-card p-4 text-sm"
                    >
                      <h3 className="font-semibold">{t("help.contents")}</h3>
                      <ul className="mt-2 space-y-2">
                        {contents.map((item) => (
                          <li key={item.id}>
                            <a
                              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                              href={`#${item.id}`}
                            >
                              {item.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  )}
                  <div
                    className="help-content"
                    onClick={handleArticleClick}
                    dangerouslySetInnerHTML={{
                      __html: renderedHtml,
                    }}
                  />
                  {related.length > 0 && (
                    <section className="mt-10 border-t border-border pt-6">
                      <h3 className="font-semibold">{t("help.related")}</h3>
                      <ul className="mt-3 space-y-2 text-sm">
                        {related.map((item) => (
                          <li key={item.slug}>
                            <Link
                              className="underline underline-offset-4 hover:text-muted-foreground"
                              to={`/help/${locale}/${item.slug}/`}
                            >
                              {item.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <p className="mt-8 text-sm text-muted-foreground">
                    {t("help.needHelp")} {contact}
                  </p>
                </>
              ) : (
                <p>{t("help.notFound")}</p>
              )}
            </main>
          </div>
        )}
      </div>
      <ScreenshotDialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        src={preview?.src ?? ""}
        alt={preview?.alt ?? ""}
        closeLabel={t("landing.preview.close")}
      />
    </div>
  );
}
