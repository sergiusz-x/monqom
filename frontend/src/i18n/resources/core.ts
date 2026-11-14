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
    help: "Help center",
    budgetHelp: "How budgets work",
    main: "Main navigation",
    mobile: "Mobile navigation",
    lightMode: "Switch to light mode",
    darkMode: "Switch to dark mode",
  },
  landing: {
    eyebrow: "Personal finance, made clear",
    title: "Your spending and budgets, all in one place.",
    description:
      "Monqom is a personal finance app for tracking expenses, setting budgets, and saving for your goals.",
    signIn: "Sign in",
    createAccount: "Create account",
    selfHost: "Self-host Monqom",
    viewOnGitHub: "View on GitHub",
    exploreFeatures: "See how it works",
    preview: {
      open: "Open full preview: {{title}}",
      close: "Close preview",
    },
    heroImageAlt: "Monqom dashboard",
    mobileImageAlt: "Monqom dashboard on a phone",
    navigation: {
      features: "Features",
      control: "Your data",
      selfHosting: "Self-hosting",
    },
    proof: {
      overview: "Add transactions manually",
      budget: "Keep budgets in view",
      ownership: "Export your data anytime",
    },
    overview: {
      eyebrow: "A clear monthly picture",
      title: "See where your money goes.",
      description:
        "Your dashboard shows your spending, categories, and trends over time, so you can see where your money goes.",
      imageAlt: "Dashboard with monthly spending trend and categories",
    },
    transactions: {
      eyebrow: "Everyday tracking",
      title: "All your transactions in one place.",
      description:
        "Add expenses and income manually. Organize them with categories and payment sources, then find them using search and filters.",
      imageAlt:
        "Transaction list with filters, categories, and payment sources",
    },
    budgets: {
      eyebrow: "Simple budgets",
      title: "See how much is left in your budget.",
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
          "Categories, payment sources, search, and filters stay close to the data.",
      },
      budgets: {
        title: "Stay close to your limits",
        description: "Set simple monthly budgets and make progress visible.",
      },
    },
    goals: {
      eyebrow: "Savings goals",
      title: "Make room for what matters to you.",
      description:
        "Set a target and a date, see how much to save each month, and record your progress as you put money aside.",
      imageAlt: "Savings goals and progress in Monqom",
    },
    steps: {
      eyebrow: "Getting started",
      title: "A clearer picture in three steps.",
      add: {
        title: "Add a transaction",
        description: "Manually add an expense or income and choose a category.",
      },
      review: {
        title: "See the bigger picture",
        description: "Review your monthly totals, categories, and trends.",
      },
      plan: {
        title: "Make a plan",
        description: "Set a budget or a savings goal and follow your progress.",
      },
    },
    control: {
      eyebrow: "Built around control",
      title: "Understand your finances and keep access to your data.",
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
      imageAlt: "Monqom dashboard on a mobile phone",
    },
    selfHostingSection: {
      eyebrow: "Use Monqom your way",
      title: "Start hosted, or run it on your own infrastructure.",
      hosted: {
        title: "Create an account",
        description:
          "Create an account and start tracking your spending without setup.",
        action: "Create account",
      },
      selfHosted: {
        title: "Host it yourself",
        description: "Run Monqom on your own server.",
        action: "Read self-hosting guide",
      },
    },
    faq: {
      eyebrow: "Good to know",
      title: "Before you get started",
      transactions: {
        question: "How do I add transactions?",
        answer:
          "You can add expenses and income manually in the app. Transactions can also be sent through the integration API.",
      },
      data: {
        question: "Can I export my data?",
        answer: "You can export your transactions as a CSV or JSON file.",
      },
      devices: {
        question: "Can I use Monqom on my phone?",
        answer:
          "Yes. You can use Monqom in a browser on your phone or computer.",
      },
    },
    finalCta: {
      title: "Start tracking your finances.",
      description:
        "Create an account to begin, or explore the source code and run Monqom yourself.",
    },
    footer: {
      contact: "Contact",
      copyright: "Open-source personal finance software.",
    },
  },
  publicPreferences: {
    title: "Display preferences",
    changeLanguage: "Change language",
    theme: "Theme",
    cycleTheme: "Current theme: {{theme}}. Click to change.",
    switchTheme: "Switch to {{theme}} theme",
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
    help: "Centrum pomocy",
    budgetHelp: "Jak działają budżety",
    main: "Główna nawigacja",
    mobile: "Nawigacja mobilna",
    lightMode: "Włącz jasny motyw",
    darkMode: "Włącz ciemny motyw",
  },
  landing: {
    eyebrow: "Finanse osobiste bez chaosu",
    title: "Twoje wydatki i budżety w jednym miejscu.",
    description:
      "Monqom to aplikacja do finansów osobistych. Zapisuj wydatki, planuj budżet i odkładaj na swoje cele.",
    signIn: "Zaloguj się",
    createAccount: "Załóż konto",
    selfHost: "Hostuj Monqom samodzielnie",
    viewOnGitHub: "Zobacz na GitHubie",
    exploreFeatures: "Zobacz, jak działa",
    preview: {
      open: "Otwórz pełny podgląd: {{title}}",
      close: "Zamknij podgląd",
    },
    heroImageAlt: "Pulpit Monqom",
    mobileImageAlt: "Pulpit Monqom na telefonie",
    navigation: {
      features: "Funkcje",
      control: "Twoje dane",
      selfHosting: "Self-hosting",
    },
    proof: {
      overview: "Dodawaj transakcje ręcznie",
      budget: "Kontroluj budżety",
      ownership: "Eksportuj transakcje, kiedy chcesz",
    },
    overview: {
      eyebrow: "Jasny obraz miesiąca",
      title: "Zobacz, na co wydajesz pieniądze.",
      description:
        "Na pulpicie zobaczysz wydatki według kategorii oraz to, jak zmieniały się w kolejnych miesiącach.",
      imageAlt: "Pulpit z trendem wydatków i kategoriami",
    },
    transactions: {
      eyebrow: "Codzienne śledzenie",
      title: "Wszystkie transakcje w jednym miejscu.",
      description:
        "Dodawaj ręcznie wydatki i przychody. Przypisuj je do kategorii i źródeł płatności, a później korzystaj z wyszukiwarki i filtrów.",
      imageAlt: "Lista transakcji z filtrami, kategoriami i źródłami płatności",
    },
    budgets: {
      eyebrow: "Proste budżety",
      title: "Sprawdź, ile zostało w budżecie.",
      description:
        "Ustaw miesięczne limity i sprawdzaj, ile jeszcze możesz wydać w każdej kategorii.",
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
          "Kategorie, źródła płatności, wyszukiwanie i filtry są blisko danych.",
      },
      budgets: {
        title: "Trzymaj się limitów",
        description: "Ustaw proste miesięczne budżety i obserwuj postęp.",
      },
    },
    goals: {
      eyebrow: "Cele oszczędnościowe",
      title: "Odkładaj na to, co jest dla Ciebie ważne.",
      description:
        "Ustal kwotę i termin, a następnie sprawdź, ile warto odkładać co miesiąc. Wpisuj kolejne wpłaty, aby śledzić postęp.",
      imageAlt: "Cele oszczędnościowe i ich postęp w Monqom",
    },
    steps: {
      eyebrow: "Jak zacząć",
      title: "Zacznij w trzech krokach.",
      add: {
        title: "Dodaj transakcję",
        description: "Dodaj ręcznie wydatek lub przychód i wybierz kategorię.",
      },
      review: {
        title: "Sprawdź podsumowanie",
        description: "Zobacz miesięczne sumy, kategorie i trendy.",
      },
      plan: {
        title: "Zaplanuj kolejny krok",
        description: "Ustaw budżet lub cel oszczędnościowy i śledź postępy.",
      },
    },
    control: {
      eyebrow: "Twoje dane",
      title: "Eksportuj transakcje i chroń dostęp do konta.",
      export: {
        title: "Eksportuj transakcje",
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
          "Korzystaj w przeglądarce na telefonie i komputerze, po polsku lub angielsku, w jasnym albo ciemnym motywie.",
      },
      imageAlt: "Pulpit Monqom na telefonie",
    },
    selfHostingSection: {
      eyebrow: "Korzystaj po swojemu",
      title: "Załóż konto albo uruchom Monqom na własnej infrastrukturze.",
      hosted: {
        title: "Załóż konto",
        description:
          "Załóż konto i zacznij śledzić wydatki bez konfiguracji.",
        action: "Załóż konto",
      },
      selfHosted: {
        title: "Hostuj samodzielnie",
        description: "Uruchom Monqom na własnym serwerze.",
        action: "Przeczytaj instrukcję",
      },
    },
    faq: {
      eyebrow: "Warto wiedzieć",
      title: "Zanim zaczniesz",
      transactions: {
        question: "Jak dodawać transakcje?",
        answer:
          "Wydatki i przychody możesz dodawać ręcznie w aplikacji. Transakcje można też przesyłać przez API integracji.",
      },
      data: {
        question: "Czy mogę wyeksportować transakcje?",
        answer: "Możesz wyeksportować transakcje do pliku CSV lub JSON.",
      },
      devices: {
        question: "Czy Monqom działa na telefonie?",
        answer:
          "Tak. Z Monqom możesz korzystać w przeglądarce na telefonie lub komputerze.",
      },
    },
    finalCta: {
      title: "Zacznij śledzić swoje finanse.",
      description:
        "Załóż konto, aby zacząć, albo zobacz kod źródłowy i uruchom Monqom samodzielnie.",
    },
    footer: {
      contact: "Kontakt",
      copyright: "Aplikacja do finansów osobistych z otwartym kodem źródłowym.",
    },
  },
  publicPreferences: {
    title: "Preferencje wyglądu",
    changeLanguage: "Zmień język",
    theme: "Motyw",
    cycleTheme: "Obecny motyw: {{theme}}. Kliknij, aby zmienić.",
    switchTheme: "Przełącz motyw na {{theme}}",
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
