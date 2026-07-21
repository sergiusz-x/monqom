import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQueryClient as render } from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import api from "@/lib/api";
import { WorkspaceProvider, useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn() },
}));

const mockGet = api.get as ReturnType<typeof vi.fn>;

function WorkspaceConsumer({ label }: { label: string }) {
  const { workspaceId, workspace, patchWorkspace } = useWorkspace();
  return (
    <div>
      <span>{`${label}:${workspaceId ?? "loading"}:${workspace?.name ?? "missing"}:${workspace?.lastPaymentSourceId ?? "none"}`}</span>
      <button
        type="button"
        onClick={() =>
          patchWorkspace({
            name: "Updated workspace",
            lastPaymentSourceId: "card-2",
          })
        }
      >
        {`update-${label}`}
      </button>
    </div>
  );
}

describe("WorkspaceProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGet.mockResolvedValue({
      data: [
        {
          id: "ws-1",
          name: "Workspace",
          timezone: "Europe/Warsaw",
          baseCurrency: "PLN",
          lastPaymentSourceId: "cash-1",
          baseCurrencyLocked: false,
        },
      ],
    });
  });

  it("restores a valid active workspace and lets the user switch it", async () => {
    const user = userEvent.setup();
    localStorage.setItem("monqom-active-workspace", "ws-2");
    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: "ws-1",
          name: "Personal",
          timezone: "UTC",
          baseCurrency: "PLN",
          lastPaymentSourceId: "cash-1",
          baseCurrencyLocked: false,
        },
        {
          id: "ws-2",
          name: "Family",
          timezone: "Europe/Warsaw",
          baseCurrency: "EUR",
          lastPaymentSourceId: "card-2",
          baseCurrencyLocked: true,
        },
      ],
    });

    render(
      <WorkspaceProvider>
        <WorkspaceSwitcher />
        <WorkspaceConsumer label="consumer" />
      </WorkspaceProvider>,
    );

    const selector = await screen.findByRole("combobox", {
      name: "Active workspace",
    });
    expect(selector).toHaveValue("ws-2");
    expect(screen.getByText("consumer:ws-2:Family:card-2")).toBeInTheDocument();

    await user.selectOptions(selector, "ws-1");
    expect(
      screen.getByText("consumer:ws-1:Personal:cash-1"),
    ).toBeInTheDocument();
    expect(localStorage.getItem("monqom-active-workspace")).toBe("ws-1");
  });

  it("shares one workspace request between all consumers", async () => {
    render(
      <WorkspaceProvider>
        <WorkspaceConsumer label="first" />
        <WorkspaceConsumer label="second" />
      </WorkspaceProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("first:ws-1:Workspace:cash-1"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("second:ws-1:Workspace:cash-1"),
      ).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      "/workspaces",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("updates all consumers through one shared workspace state", async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceProvider>
        <WorkspaceSwitcher />
        <WorkspaceConsumer label="first" />
        <WorkspaceConsumer label="second" />
      </WorkspaceProvider>,
    );

    await screen.findByText("first:ws-1:Workspace:cash-1");
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "update-first" }));

    expect(screen.getByText("Updated workspace")).toBeInTheDocument();
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(
      screen.getByText("first:ws-1:Updated workspace:card-2"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("second:ws-1:Updated workspace:card-2"),
    ).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
