import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { PaymentSourceDialog } from "@/components/payment-sources/PaymentSourceDialog";

vi.mock("@/lib/api", () => ({
  default: { post: vi.fn(), put: vi.fn() },
}));

import api from "@/lib/api";

const mockApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

describe("PaymentSourceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a payment source and returns it to the parent", async () => {
    const user = userEvent.setup();
    const source = {
      id: "source-1",
      workspace_id: "ws-1",
      name: "Revolut",
      type: "bank" as const,
      system_key: null,
      is_archived: false,
      archived_at: null,
      created_at: "2026-07-19T00:00:00.000Z",
      updated_at: "2026-07-19T00:00:00.000Z",
    };
    mockApi.post.mockResolvedValue({ data: source });
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <PaymentSourceDialog
        open
        workspaceId="ws-1"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Revolut");
    await user.selectOptions(screen.getByLabelText("Type"), "bank");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/payment-sources",
      { name: "Revolut", type: "bank" },
    );
    expect(onSaved).toHaveBeenCalledWith({
      id: "source-1",
      workspaceId: "ws-1",
      name: "Revolut",
      type: "bank",
      systemKey: null,
      isArchived: false,
      archivedAt: null,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
