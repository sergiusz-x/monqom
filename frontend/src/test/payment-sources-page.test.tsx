import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import PaymentSourcesPage from "@/pages/PaymentSourcesPage";
import i18n from "@/i18n";
import { ToastProvider } from "@/contexts/ToastContext";
import type { PaymentSource } from "@/types/payment-source";

const refetch = vi.fn().mockResolvedValue(undefined);
let paymentSources: PaymentSource[] = [
  {
    id: "cash-1",
    workspaceId: "ws-1",
    name: "Cash",
    type: "cash" as const,
    systemKey: "cash",
    isArchived: false,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1" }),
}));

vi.mock("@/hooks/usePaymentSources", () => ({
  usePaymentSources: () => ({
    paymentSources,
    isLoading: false,
    error: null,
    refetch,
  }),
}));

vi.mock("@/components/payment-sources/PaymentSourceDialog", () => ({
  PaymentSourceDialog: () => null,
}));

vi.mock("@/lib/api", () => ({
  default: { post: vi.fn() },
}));

import api from "@/lib/api";
const mockPost = api.post as ReturnType<typeof vi.fn>;

describe("PaymentSourcesPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    paymentSources = [
      {
        id: "cash-1",
        workspaceId: "ws-1",
        name: "Cash",
        type: "cash",
        systemKey: "cash",
        isArchived: false,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    await i18n.changeLanguage("en");
  });

  it("archives a source only after accessible confirmation", async () => {
    const user = userEvent.setup();
    paymentSources = [
      {
        ...paymentSources[0],
        id: "card-1",
        name: "Daily card",
        type: "debit_card",
        systemKey: null,
      },
    ];
    mockPost.mockResolvedValueOnce({});
    render(
      <ToastProvider>
        <PaymentSourcesPage />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(mockPost).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Archive" });
    expect(dialog).toHaveAccessibleDescription(
      "Archive Daily card? Historical transactions will keep this source.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/workspaces/ws-1/payment-sources/card-1/archive",
      ),
    );
  });

  it("renders payment sources as a standalone page", () => {
    render(
      <ToastProvider>
        <PaymentSourcesPage />
      </ToastProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Payment sources" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Cash")).toHaveLength(2);
    expect(screen.queryByText("System")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();
  });
});
