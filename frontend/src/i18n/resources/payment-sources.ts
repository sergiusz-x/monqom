import type { TranslationShape } from "./types";

export const enPaymentSources = {
  paymentSources: {
    title: "Payment sources",
    shortTitle: "Sources",
    description:
      "Manage the accounts and methods used to pay for transactions.",
    add: "Add payment source",
    quickAdd: "Add payment source",
    edit: "Edit payment source",
    name: "Name",
    type: "Type",
    system: "System",
    systemCash: "Cash",
    archived: "Archived",
    archive: "Archive",
    archiveConfirm:
      "Archive {{name}}? Historical transactions will keep this source.",
    archivedSuccess: "Payment source archived",
    archiveError: "Failed to archive payment source",
    saved: "Payment source saved",
    saveError: "Failed to save payment source. The name may already be in use.",
    loadError: "Failed to load payment sources",
    empty: "No payment sources yet",
    emptyDescription:
      "Add a payment source to describe how transactions were paid.",
    nameRequired: "Name is required",
    nameTooLong: "Name must be 100 characters or fewer",
    required: "Payment source is required",
    types: {
      cash: "Cash",
      bank: "Bank account",
      debit_card: "Debit card",
      credit_card: "Credit card",
      other: "Other",
    },
  },
} as const;

export const plPaymentSources = {
  paymentSources: {
    title: "Źródła płatności",
    shortTitle: "Źródła",
    description:
      "Zarządzaj kontami i metodami używanymi do opłacania transakcji.",
    add: "Dodaj źródło",
    quickAdd: "Dodaj źródło płatności",
    edit: "Edytuj źródło płatności",
    name: "Nazwa",
    type: "Typ",
    system: "Systemowe",
    systemCash: "Gotówka",
    archived: "Archiwalne",
    archive: "Archiwizuj",
    archiveConfirm:
      "Zarchiwizować {{name}}? Historyczne transakcje zachowają to źródło.",
    archivedSuccess: "Źródło płatności zarchiwizowane",
    archiveError: "Nie udało się zarchiwizować źródła płatności",
    saved: "Źródło płatności zapisane",
    saveError: "Nie udało się zapisać źródła. Nazwa może być już używana.",
    loadError: "Nie udało się wczytać źródeł płatności",
    empty: "Brak źródeł płatności",
    emptyDescription:
      "Dodaj źródło płatności, aby określać sposób opłacenia transakcji.",
    nameRequired: "Nazwa jest wymagana",
    nameTooLong: "Nazwa może mieć maksymalnie 100 znaków",
    required: "Źródło płatności jest wymagane",
    types: {
      cash: "Gotówka",
      bank: "Konto bankowe",
      debit_card: "Karta debetowa",
      credit_card: "Karta kredytowa",
      other: "Inne",
    },
  },
} as const satisfies TranslationShape<typeof enPaymentSources>;
