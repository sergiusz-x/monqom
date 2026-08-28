import type { TranslationShape } from "./types";

export const enCore = {
  common: {
    versionPrefix: "v",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    loading: "Loading…",
    delete: "Delete",
    edit: "Edit",
    previous: "Prev",
    next: "Next",
    none: "None",
    amount: "Amount",
    currency: "Currency",
    currencyCode: "Currency: {{currency}}",
    date: "Date",
    category: "Category",
    notes: "Notes",
    tags: "Tags",
    paymentSource: "Payment source",
    error: "Something went wrong.",
    retry: "Try again",
    noWorkspace: "No workspace found.",
    dismissNotification: "Dismiss notification",
    notifications: "Notifications",
  },
  apiErrors: {
    invalidCredentials: "Invalid email or password.",
    emailNotVerified: "Verify your email address before signing in.",
    emailAlreadyExists: "An account with this email already exists.",
    invalidVerificationToken:
      "The verification link is invalid or has expired.",
    invalidResetToken: "The password reset link is invalid or has expired.",
    authenticationRequired: "Your session has expired. Sign in again.",
    validation: "Check the entered data and try again.",
    accessDenied: "You do not have permission to perform this action.",
    notFound: "The requested resource was not found.",
    conflict: "This operation conflicts with the current data.",
    rateLimited: "Too many attempts. Please try again later.",
    internal: "A server error occurred. Please try again later.",
    network: "Could not connect to the server. Check your connection.",
    generic: "Something went wrong. Please try again.",
    logoutFailed: "Could not log out. Please try again.",
  },
  nav: {
    dashboard: "Dashboard",
    goToDashboard: "Go to dashboard",
    transactions: "Transactions",
    budgets: "Budgets",
    goals: "Goals",
    more: "More",
    settings: "Settings",
    addTransaction: "Add transaction",
    logout: "Log out",
    account: "Account menu",
    main: "Main navigation",
    mobile: "Mobile navigation",
    lightMode: "Switch to light mode",
    darkMode: "Switch to dark mode",
  },
  landing: {
    eyebrow: "Personal finance, made clear",
    title: "Understand your money without the complexity.",
    description:
      "Track everyday spending, stay within budget, and keep your financial data under your control.",
    signIn: "Sign in",
    createAccount: "Create account",
    selfHost: "Self-host Monqom",
    viewOnGitHub: "View on GitHub",
    exploreFeatures: "Explore features",
    preview: {
      open: "Open full preview: {{title}}",
      close: "Close preview",
    },
    heroImageAlt: "Monqom dashboard in dark mode",
    navigation: {
      features: "Features",
      control: "Your data",
      selfHosting: "Self-hosting",
    },
    proof: {
      overview: "See the month at a glance",
      budget: "Keep budgets in view",
      ownership: "Export your data anytime",
    },
    overview: {
      eyebrow: "A clear monthly picture",
      title: "Know what happened before deciding what to do next.",
      description:
        "Your dashboard brings spending, category breakdowns, trends, and recent activity into one calm place.",
      imageAlt: "Dashboard with monthly spending trend and categories",
    },
    transactions: {
      eyebrow: "Everyday tracking",
      title: "Capture the details that make your spending make sense.",
      description:
        "Record expenses in seconds, then use categories, payment sources, tags, search, and filters to find what matters.",
      imageAlt:
        "Transaction list with filters, categories, tags, and payment sources",
    },
    budgets: {
      eyebrow: "Simple budgets",
      title: "Give each category a clear monthly boundary.",
      description:
        "Set practical limits, follow progress at a glance, and spot the categories that need attention before the month is over.",
      imageAlt: "Monthly budget progress in Monqom",
    },
    featureCards: {
      dashboard: {
        title: "See the full picture",
        description:
          "Monthly totals, category breakdowns, trends, and recent activity.",
      },
      organization: {
        title: "Keep spending organized",
        description:
          "Categories, tags, payment sources, search, and filters stay close to the data.",
      },
      budgets: {
        title: "Stay close to your limits",
        description: "Set simple monthly budgets and make progress visible.",
      },
    },
    control: {
      eyebrow: "Built around control",
      title: "Your finances should stay understandable and portable.",
      export: {
        title: "Take your data with you",
        description:
          "Export transactions as CSV or JSON whenever you need them.",
      },
      account: {
        title: "Protect account access",
        description:
          "Email verification, password recovery, sessions, and optional two-factor authentication are built in.",
      },
      mobile: {
        title: "Works across devices",
        description:
          "A responsive interface, dark mode, and Polish or English keep the experience comfortable.",
      },
      imageAlt: "Monqom dashboard on a mobile phone in dark mode",
    },
    selfHostingSection: {
      eyebrow: "Use Monqom your way",
      title: "Start hosted, or run it on your own infrastructure.",
      hosted: {
        title: "Create an account",
        description:
          "Use the hosted version and begin tracking your spending without any setup.",
        action: "Create account",
      },
      selfHosted: {
        title: "Self-host Monqom",
        description:
          "Run the open-source core on infrastructure you control with Docker and PostgreSQL.",
        action: "Read self-hosting guide",
      },
    },
    finalCta: {
      title: "A clearer view of your money starts here.",
      description:
        "Create an account to begin, or explore the source code and run Monqom yourself.",
    },
    footer: {
      source: "Source code",
      selfHosting: "Self-hosting guide",
      security: "Security policy",
      license: "AGPL-3.0",
      copyright: "Open-source personal finance software.",
    },
  },
  publicPreferences: {
    title: "Display preferences",
    changeLanguage: "Change language",
    theme: "Theme",
    cycleTheme: "Current theme: {{theme}}. Click to change.",
    system: "System",
    light: "Light",
    dark: "Dark",
  },
  messages: {
    transactionSaved: "Transaction saved successfully.",
    offline: "You are offline. Connect to the internet to access current data.",
    updateFailed: "The app update could not be prepared. Try again later.",
  },
  workspaceSwitcher: { label: "Active workspace" },
  currency: {
    rateUnavailable: "No reference exchange rate is available for this date.",
  },
} as const;

export const plCore = {
  common: {
    versionPrefix: "w.",
    save: "Zapisz",
    cancel: "Anuluj",
    close: "Zamknij",
    loading: "Ładowanie…",
    delete: "Usuń",
    edit: "Edytuj",
    previous: "Poprzedni",
    next: "Następny",
    none: "Brak",
    amount: "Kwota",
    currency: "Waluta",
    currencyCode: "Waluta: {{currency}}",
    date: "Data",
    category: "Kategoria",
    notes: "Notatki",
    tags: "Tagi",
    paymentSource: "Źródło płatności",
    error: "Wystąpił błąd.",
    retry: "Spróbuj ponownie",
    noWorkspace: "Nie znaleziono workspace.",
    dismissNotification: "Zamknij powiadomienie",
    notifications: "Powiadomienia",
  },
  apiErrors: {
    invalidCredentials: "Nieprawidłowy adres e-mail lub hasło.",
    emailNotVerified: "Zweryfikuj adres e-mail przed zalogowaniem.",
    emailAlreadyExists: "Konto z tym adresem e-mail już istnieje.",
    invalidVerificationToken:
      "Link weryfikacyjny jest nieprawidłowy lub wygasł.",
    invalidResetToken: "Link do zmiany hasła jest nieprawidłowy lub wygasł.",
    authenticationRequired: "Sesja wygasła. Zaloguj się ponownie.",
    validation: "Sprawdź wprowadzone dane i spróbuj ponownie.",
    accessDenied: "Nie masz uprawnień do wykonania tej operacji.",
    notFound: "Nie znaleziono żądanego zasobu.",
    conflict: "Ta operacja jest sprzeczna z aktualnym stanem danych.",
    rateLimited: "Zbyt wiele prób. Spróbuj ponownie później.",
    internal: "Wystąpił błąd serwera. Spróbuj ponownie później.",
    network: "Nie udało się połączyć z serwerem. Sprawdź połączenie.",
    generic: "Wystąpił błąd. Spróbuj ponownie.",
    logoutFailed: "Nie udało się wylogować. Spróbuj ponownie.",
  },
  nav: {
    dashboard: "Pulpit",
    goToDashboard: "Przejdź do pulpitu",
    transactions: "Transakcje",
    budgets: "Budżety",
    goals: "Cele",
    more: "Więcej",
    settings: "Ustawienia",
    addTransaction: "Dodaj transakcję",
    logout: "Wyloguj się",
    account: "Menu konta",
    main: "Główna nawigacja",
    mobile: "Nawigacja mobilna",
    lightMode: "Włącz jasny motyw",
    darkMode: "Włącz ciemny motyw",
  },
  landing: {
    eyebrow: "Finanse osobiste bez chaosu",
    title: "Zrozum swoje finanse bez zbędnych komplikacji.",
    description:
      "Śledź codzienne wydatki, pilnuj budżetu i zachowaj kontrolę nad swoimi danymi finansowymi.",
    signIn: "Zaloguj się",
    createAccount: "Załóż konto",
    selfHost: "Hostuj Monqom samodzielnie",
    viewOnGitHub: "Zobacz na GitHubie",
    exploreFeatures: "Poznaj funkcje",
    preview: {
      open: "Otwórz pełny podgląd: {{title}}",
      close: "Zamknij podgląd",
    },
    heroImageAlt: "Pulpit Monqom w ciemnym motywie",
    navigation: {
      features: "Funkcje",
      control: "Twoje dane",
      selfHosting: "Self-hosting",
    },
    proof: {
      overview: "Zobacz cały miesiąc na jednym ekranie",
      budget: "Kontroluj budżety",
      ownership: "Eksportuj dane kiedy chcesz",
    },
    overview: {
      eyebrow: "Jasny obraz miesiąca",
      title: "Najpierw zobacz, co się wydarzyło. Potem zdecyduj, co dalej.",
      description:
        "Pulpit łączy wydatki, strukturę kategorii, trendy i ostatnią aktywność w jednym spokojnym widoku.",
      imageAlt: "Pulpit z trendem wydatków i kategoriami",
    },
    transactions: {
      eyebrow: "Codzienne śledzenie",
      title: "Zapisuj szczegóły, dzięki którym wydatki mają sens.",
      description:
        "Dodawaj wydatki w kilka chwil, a potem korzystaj z kategorii, źródeł płatności, tagów, wyszukiwania i filtrów.",
      imageAlt:
        "Lista transakcji z filtrami, kategoriami, tagami i źródłami płatności",
    },
    budgets: {
      eyebrow: "Proste budżety",
      title: "Nadaj każdej kategorii czytelną miesięczną granicę.",
      description:
        "Ustaw praktyczne limity, śledź postęp i zauważ kategorie wymagające uwagi, zanim miesiąc się skończy.",
      imageAlt: "Miesięczny postęp budżetów w Monqom",
    },
    featureCards: {
      dashboard: {
        title: "Zobacz pełny obraz",
        description: "Miesięczne sumy, kategorie, trendy i ostatnia aktywność.",
      },
      organization: {
        title: "Uporządkuj wydatki",
        description:
          "Kategorie, tagi, źródła płatności, wyszukiwanie i filtry są blisko danych.",
      },
      budgets: {
        title: "Trzymaj się limitów",
        description: "Ustaw proste miesięczne budżety i obserwuj postęp.",
      },
    },
    control: {
      eyebrow: "Zaprojektowany z myślą o kontroli",
      title: "Twoje finanse powinny być zrozumiałe i możliwe do przeniesienia.",
      export: {
        title: "Zabierz swoje dane",
        description:
          "Eksportuj transakcje do CSV lub JSON, kiedy tylko tego potrzebujesz.",
      },
      account: {
        title: "Chroń dostęp do konta",
        description:
          "Weryfikacja e-mail, odzyskiwanie hasła, sesje i opcjonalne 2FA są dostępne w aplikacji.",
      },
      mobile: {
        title: "Działa na różnych urządzeniach",
        description:
          "Responsywny interfejs, ciemny motyw oraz polski i angielski zapewniają wygodę.",
      },
      imageAlt: "Pulpit Monqom na telefonie w ciemnym motywie",
    },
    selfHostingSection: {
      eyebrow: "Korzystaj po swojemu",
      title: "Załóż konto albo uruchom Monqom na własnej infrastrukturze.",
      hosted: {
        title: "Załóż konto",
        description:
          "Skorzystaj z hostowanej wersji i zacznij śledzić wydatki bez konfiguracji.",
        action: "Załóż konto",
      },
      selfHosted: {
        title: "Hostuj Monqom samodzielnie",
        description:
          "Uruchom otwarty rdzeń na infrastrukturze, którą kontrolujesz, z Dockerem i PostgreSQL.",
        action: "Przeczytaj instrukcję",
      },
    },
    finalCta: {
      title: "Wyraźniejszy obraz finansów zaczyna się tutaj.",
      description:
        "Załóż konto, aby zacząć, albo zobacz kod źródłowy i uruchom Monqom samodzielnie.",
    },
    footer: {
      source: "Kod źródłowy",
      selfHosting: "Instrukcja self-hostingu",
      security: "Polityka bezpieczeństwa",
      license: "AGPL-3.0",
      copyright: "Open-source'owe oprogramowanie do finansów osobistych.",
    },
  },
  publicPreferences: {
    title: "Preferencje wyglądu",
    changeLanguage: "Zmień język",
    theme: "Motyw",
    cycleTheme: "Obecny motyw: {{theme}}. Kliknij, aby zmienić.",
    system: "Systemowy",
    light: "Jasny",
    dark: "Ciemny",
  },
  messages: {
    transactionSaved: "Transakcja została zapisana.",
    offline:
      "Brak połączenia. Połącz się z internetem, aby pobrać aktualne dane.",
    updateFailed:
      "Nie udało się przygotować aktualizacji aplikacji. Spróbuj później.",
  },
  workspaceSwitcher: { label: "Aktywny workspace" },
  currency: {
    rateUnavailable: "Brak referencyjnego kursu walut dla wybranej daty.",
  },
} as const satisfies TranslationShape<typeof enCore>;
