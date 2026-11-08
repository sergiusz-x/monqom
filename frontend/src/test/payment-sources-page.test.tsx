import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import PaymentSourcesPage from "@/pages/PaymentSourcesPage";
import i18n from "@/i18n";

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
import { ToastProvider } from "@monqom/ui";
const mockPost = api.post as ReturnType<typeof vi.fn>;

describe("PaymentSourcesPage", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
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
        ...paymentSources[0]!,
        id: "card-1",
        name: "Daily card",
        type: "debit_card",
        systemKey: null,
      },
    ];
    mockPost.mockResolvedValueOnce({});
    const { queryClient } = render(
      <ToastProvider>
        <PaymentSourcesPage />
      </ToastProvider>,
    );
    queryClient.setQueryData(
      ["workspaces"],
      [{ id: "ws-1", lastPaymentSourceId: "card-1" }],
    );

    await user.click(
      screen.getByRole("button", { name: "Options for Daily card" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(mockPost).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Archive" });
    expect(dialog).toHaveAccessibleDescription(
      "Archive Daily card? It will no longer be available for new transactions, but existing transactions will keep it. If it was last used, Cash will be selected instead.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/workspaces/ws-1/payment-sources/card-1/archive",
      );
      expect(queryClient.getQueryState(["workspaces"])?.isInvalidated).toBe(
        true,
      );
    });
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
    expect(screen.getAllByText("Cash")).toHaveLength(1);
    expect(screen.queryByText("System")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" }),
    ).not.toBeInTheDocument();
  });
  it("keeps archived sources separate and restores them", async () => {
    const user = userEvent.setup();
    paymentSources = [
      paymentSources[0]!,
      {
        ...paymentSources[0]!,
        id: "card-1",
        name: "Old card",
        type: "debit_card",
        systemKey: null,
        isArchived: true,
      },
    ];
    mockPost.mockResolvedValueOnce({ data: {} });
    render(
      <ToastProvider>
        <PaymentSourcesPage />
      </ToastProvider>,
    );
    expect(screen.queryByText("Old card")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Archived" }));
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/workspaces/ws-1/payment-sources/card-1/restore",
      ),
    );
  });

  it("explains a restore name conflict", async () => {
    const user = userEvent.setup();
    paymentSources = [
      {
        ...paymentSources[0]!,
        id: "card-1",
        name: "Old card",
        type: "debit_card",
        systemKey: null,
        isArchived: true,
      },
    ];
    mockPost.mockRejectedValueOnce({ response: { status: 409 } });
    render(
      <ToastProvider>
        <PaymentSourcesPage />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("tab", { name: "Archived" }));
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(
      await screen.findByText(/An active payment source already has this name/),
    ).toBeInTheDocument();
  });
});
