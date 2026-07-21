import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "@/pages/SettingsPage";
import {
  AuthContext,
  type AuthContextValue,
  type User,
} from "@/contexts/AuthContext";

vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: vi.fn() }));

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { useWorkspace } from "@/hooks/useWorkspace";
import api from "@/lib/api";
import i18n from "@/i18n";
import { ToastProvider } from "@/contexts/ToastContext";

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
const patchWorkspace = vi.fn();

const testUser: User = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  emailVerified: true,
  totpEnabled: false,
  createdAt: "2026-03-20T00:00:00.000Z",
  updatedAt: "2026-03-20T00:00:00.000Z",
};

function renderSettings(authOverrides: Partial<AuthContextValue> = {}) {
  const authValue: AuthContextValue = {
    user: testUser,
    isLoading: false,
    login: vi.fn() as unknown as AuthContextValue["login"],
    logout: vi.fn() as unknown as AuthContextValue["logout"],
    setUser: vi.fn(),
    ...authOverrides,
  };

  render(
    <ToastProvider>
      <AuthContext.Provider value={authValue}>
        <SettingsPage />
      </AuthContext.Provider>
    </ToastProvider>,
  );

  return authValue;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
  mockUseWorkspace.mockReturnValue({
    workspaceId: "ws-1",
    workspace: {
      id: "ws-1",
      name: "Ada's Finances",
      timezone: "UTC",
      baseCurrency: "USD",
      lastPaymentSourceId: "cash-1",
      baseCurrencyLocked: false,
    },
    isLoading: false,
    error: null,
    patchWorkspace,
    refetch: vi.fn(),
  });
});

describe("SettingsPage", () => {
  it("saves a valid display name and updates auth state", async () => {
    const user = userEvent.setup();
    const updatedUser = { ...testUser, name: "Grace Hopper" };
    mockApi.put.mockResolvedValueOnce({ data: updatedUser });
    const authValue = renderSettings();

    const nameInput = screen.getByLabelText("Display name");
    await user.clear(nameInput);
    await user.type(nameInput, " Grace Hopper ");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1));
    expect(mockApi.put).toHaveBeenCalledWith("/users/me", {
      name: "Grace Hopper",
      locale: "en",
    });
    expect(authValue.setUser).toHaveBeenCalledWith(updatedUser);
    expect(screen.getByRole("status")).toHaveTextContent("Profile saved");
  });

  it("validates display name before saving", async () => {
    const user = userEvent.setup();
    renderSettings();

    const nameInput = screen.getByLabelText("Display name");
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(mockApi.put).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Display name is required",
    );
  });

  it("saves workspace name and timezone", async () => {
    const user = userEvent.setup();
    mockApi.put.mockResolvedValueOnce({
      data: {
        id: "ws-1",
        name: "Household budget",
        timezone: "Europe/Warsaw",
      },
    });
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Workspace" }));
    const workspaceName = screen.getByLabelText("Workspace name");
    expect(workspaceName).toHaveValue("Ada's Finances");
    await user.clear(workspaceName);
    await user.type(workspaceName, " Household budget ");

    await user.selectOptions(
      screen.getByLabelText("Timezone"),
      "Europe/Warsaw",
    );
    await user.click(screen.getByRole("button", { name: "Save workspace" }));

    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1));
    expect(mockApi.put).toHaveBeenCalledWith("/workspaces/ws-1", {
      name: "Household budget",
      timezone: "Europe/Warsaw",
      base_currency: "USD",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Workspace saved");
    expect(patchWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Household budget" }),
    );
  });

  it("validates workspace name before saving", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Workspace" }));
    const workspaceName = screen.getByLabelText("Workspace name");
    await user.clear(workspaceName);
    await user.click(screen.getByRole("button", { name: "Save workspace" }));

    expect(mockApi.put).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Workspace name must be at least 2 characters",
    );
  });

  it("explains and disables a locked base currency", async () => {
    const user = userEvent.setup();
    mockUseWorkspace.mockReturnValue({
      workspaceId: "ws-1",
      workspace: {
        id: "ws-1",
        name: "Ada's Finances",
        timezone: "UTC",
        baseCurrency: "PLN",
        lastPaymentSourceId: "cash-1",
        baseCurrencyLocked: true,
      },
      isLoading: false,
      error: null,
      patchWorkspace,
      refetch: vi.fn(),
    });
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Workspace" }));

    expect(screen.getByLabelText("Workspace base currency")).toBeDisabled();
    expect(
      screen.getByText(
        "The base currency is locked because this workspace already contains a transaction or budget.",
      ),
    ).toBeInTheDocument();
  });

  it("changes password through the security section", async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValueOnce({ data: { message: "ok" } });
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Security" }));
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await user.type(
      screen.getByLabelText("Current password"),
      "CurrentPass123!",
    );
    await user.type(screen.getByLabelText("New password"), "NewPassword123!");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "NewPassword123!",
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "CurrentPass123!",
      newPassword: "NewPassword123!",
    });
  });

  it("triggers a CSV export download", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:export");
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    mockApi.get.mockResolvedValueOnce({ data: new Blob(["date,amount"]) });
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Data" }));
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1));
    expect(mockApi.get).toHaveBeenCalledWith("/workspaces/ws-1/export", {
      params: { format: "csv" },
      responseType: "blob",
    });
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it("requires DELETE confirmation before deleting an account", async () => {
    const user = userEvent.setup();
    mockApi.delete.mockResolvedValueOnce({ data: { message: "deleted" } });
    const authValue = renderSettings();

    await user.click(screen.getByRole("button", { name: "Data" }));
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(mockApi.delete).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Type DELETE to confirm account deletion",
    );

    await user.type(screen.getByLabelText("Deletion confirmation"), "DELETE");
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() =>
      expect(mockApi.delete).toHaveBeenCalledWith("/users/me"),
    );
    expect(authValue.setUser).toHaveBeenCalledWith(null);
  });
});
