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
    put: vi.fn(),
  },
}));

import { useWorkspace } from "@/hooks/useWorkspace";
import api from "@/lib/api";

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const mockApi = api as unknown as {
  put: ReturnType<typeof vi.fn>;
};

const testUser: User = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  emailVerified: true,
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
    <AuthContext.Provider value={authValue}>
      <SettingsPage />
    </AuthContext.Provider>,
  );

  return authValue;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseWorkspace.mockReturnValue({
    workspaceId: "ws-1",
    workspace: {
      id: "ws-1",
      name: "Ada's Finances",
      timezone: "UTC",
    },
    isLoading: false,
    error: null,
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

  it("saves workspace timezone and displays workspace name", async () => {
    const user = userEvent.setup();
    mockApi.put.mockResolvedValueOnce({
      data: {
        id: "ws-1",
        name: "Ada's Finances",
        timezone: "Europe/Warsaw",
      },
    });
    renderSettings();

    await user.click(screen.getByRole("button", { name: "Workspace" }));
    expect(screen.getByText("Ada's Finances")).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Timezone"),
      "Europe/Warsaw",
    );
    await user.click(screen.getByRole("button", { name: "Save workspace" }));

    await waitFor(() => expect(mockApi.put).toHaveBeenCalledTimes(1));
    expect(mockApi.put).toHaveBeenCalledWith("/workspaces/ws-1", {
      timezone: "Europe/Warsaw",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Workspace saved");
  });
});
