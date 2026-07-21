import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act, within } from "@testing-library/react";
import {
  renderWithQueryClient as render,
  renderHookWithQueryClient as renderHook,
} from "@/test/query-test-utils";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthContext } from "@/contexts/AuthContext";
import type { User, AuthContextValue } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import { ToastProvider } from "@/contexts/ToastContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "ws-1",
    workspace: {
      id: "ws-1",
      name: "Household budget",
      timezone: "Europe/Warsaw",
      baseCurrency: "PLN",
      lastPaymentSourceId: null,
      baseCurrencyLocked: false,
    },
    workspaces: [
      {
        id: "ws-1",
        name: "Household budget",
        timezone: "Europe/Warsaw",
        baseCurrency: "PLN",
        lastPaymentSourceId: null,
        baseCurrencyLocked: false,
      },
    ],
    patchWorkspace: vi.fn(),
    setActiveWorkspace: vi.fn(),
  })),
}));
vi.mock("@/components/transactions/TransactionFormModal", () => ({
  TransactionFormModal: ({ open }: { open: boolean }) =>
    open ? (
      <div role="dialog" aria-label="Add transaction">
        Modal
      </div>
    ) : null,
}));

const testUser: User = {
  id: "1",
  email: "alice@example.com",
  name: "Alice Smith",
  emailVerified: true,
  totpEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeAuthValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    user: testUser,
    isLoading: false,
    login: vi.fn() as unknown as AuthContextValue["login"],
    logout: vi.fn().mockResolvedValue(undefined),
    setUser: vi.fn(),
    ...overrides,
  };
}

function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderWithAuthAndRouter(
  element: React.ReactNode,
  authValue = makeAuthValue(),
) {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AuthContext.Provider value={authValue}>
            <Routes>
              <Route element={element}>
                <Route path="/dashboard" element={<div>Dashboard</div>} />
              </Route>
            </Routes>
          </AuthContext.Provider>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  );
}

// ─── ThemeProvider ───────────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );

  it("defaults to system mode and follows a light operating system", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(localStorage.getItem("monqom-theme")).toBe("system");
  });

  it("migrates the legacy preference once", () => {
    localStorage.setItem("monqom-dark-mode", "true");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("monqom-theme")).toBe("dark");
    expect(localStorage.getItem("monqom-dark-mode")).toBeNull();
  });

  it("changes mode, DOM metadata, color scheme, and storage atomically", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setMode("dark");
    });

    expect(result.current.mode).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("monqom-theme")).toBe("dark");

    act(() => {
      result.current.setMode("light");
    });

    expect(result.current.mode).toBe("light");
    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("monqom-theme")).toBe("light");
  });

  it("falls back to prefers-color-scheme: dark when localStorage is empty", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe("system");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reacts to operating-system changes while system mode is active", () => {
    let handleChange: ((event: MediaQueryListEvent) => void) | undefined;
    const removeEventListener = vi.fn();
    const mediaQuery = {
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(
        (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          handleChange = listener;
        },
      ),
      removeEventListener,
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mediaQuery),
    );

    const { result, unmount } = renderHook(() => useTheme(), { wrapper });
    act(() => handleChange?.({ matches: true } as MediaQueryListEvent));

    expect(result.current.mode).toBe("system");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement).toHaveClass("dark");

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", handleChange);
  });

  it("accepts a preference changed in another browser tab", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "monqom-theme",
          newValue: "dark",
        }),
      );
    });

    expect(result.current.mode).toBe("dark");
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement).toHaveClass("dark");
  });

  it("keeps every consumer synchronized through one provider", async () => {
    function Consumer({ label }: { label: string }) {
      const { mode, isDark, setMode } = useTheme();
      return (
        <button type="button" onClick={() => setMode("dark")}>
          {label}:{mode}:{String(isDark)}
        </button>
      );
    }

    render(
      <ThemeProvider>
        <Consumer label="first" />
        <Consumer label="second" />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: /first:/i }));
    expect(
      screen.getByRole("button", { name: "first:dark:true" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "second:dark:true" }),
    ).toBeInTheDocument();
  });
});

// ─── Sidebar ──────────────────────────────────────────────────────────────────

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  function renderSidebar(authValue = makeAuthValue()) {
    const onAddTransaction = vi.fn();
    const utils = render(
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <AuthContext.Provider value={authValue}>
              <Sidebar onAddTransaction={onAddTransaction} />
            </AuthContext.Provider>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>,
    );
    return { ...utils, onAddTransaction };
  }

  it("links the brand to the dashboard", () => {
    renderSidebar();
    expect(
      screen.getByRole("link", { name: "Go to dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("renders all navigation links", () => {
    renderSidebar();
    expect(
      screen.getByRole("link", { name: /^dashboard$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /transactions/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /budgets/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("displays user name and email", () => {
    renderSidebar();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("renders Add Transaction button and calls handler", async () => {
    const { onAddTransaction } = renderSidebar();
    await userEvent.click(
      screen.getByRole("button", { name: /add transaction/i }),
    );
    expect(onAddTransaction).toHaveBeenCalledTimes(1);
  });

  it("renders logout button and calls logout", async () => {
    const logoutMock = vi.fn().mockResolvedValue(undefined);
    renderSidebar(makeAuthValue({ logout: logoutMock }));
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the user informed when logout fails", async () => {
    const logoutMock = vi.fn().mockRejectedValue(new Error("network"));
    renderSidebar(makeAuthValue({ logout: logoutMock }));
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(
      await screen.findByText("Could not log out. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("defaults to one theme button in system mode", () => {
    renderSidebar();

    expect(
      screen.getByRole("button", {
        name: "Current theme: System. Click to change.",
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("monqom-theme")).toBe("system");
  });

  it("cycles system, light, dark, and back to system", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(
      screen.getByRole("button", {
        name: "Current theme: System. Click to change.",
      }),
    );
    expect(localStorage.getItem("monqom-theme")).toBe("light");

    await user.click(
      screen.getByRole("button", {
        name: "Current theme: Light. Click to change.",
      }),
    );
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("monqom-theme")).toBe("dark");

    await user.click(
      screen.getByRole("button", {
        name: "Current theme: Dark. Click to change.",
      }),
    );
    expect(localStorage.getItem("monqom-theme")).toBe("system");
  });

  it("does not render user info when user is null", () => {
    renderSidebar(makeAuthValue({ user: null }));
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
  });
});

// ─── BottomNav ────────────────────────────────────────────────────────────────

describe("BottomNav", () => {
  function renderBottomNav() {
    const onAddTransaction = vi.fn();
    const utils = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <BottomNav onAddTransaction={onAddTransaction} />
      </MemoryRouter>,
    );
    return { ...utils, onAddTransaction };
  }

  it("renders all navigation links", () => {
    renderBottomNav();
    expect(
      screen.getByRole("link", { name: /^dashboard$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /transactions/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /budgets/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders Add Transaction button", () => {
    renderBottomNav();
    expect(
      screen.getByRole("button", { name: /add transaction/i }),
    ).toBeInTheDocument();
  });

  it("calls onAddTransaction when + button is clicked", async () => {
    const { onAddTransaction } = renderBottomNav();
    await userEvent.click(
      screen.getByRole("button", { name: /add transaction/i }),
    );
    expect(onAddTransaction).toHaveBeenCalledTimes(1);
  });
});

// ─── AppLayout ────────────────────────────────────────────────────────────────

describe("AppLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders without crashing and shows outlet content", () => {
    renderWithAuthAndRouter(<AppLayout />);
    const main = screen.getByRole("main");
    expect(within(main).getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders sidebar landmark", () => {
    renderWithAuthAndRouter(<AppLayout />);
    expect(
      screen.getByRole("complementary", { name: /main navigation/i }),
    ).toBeInTheDocument();
  });

  it("renders mobile navigation landmark", () => {
    renderWithAuthAndRouter(<AppLayout />);
    expect(
      screen.getByRole("navigation", { name: /mobile navigation/i }),
    ).toBeInTheDocument();
  });

  it("renders main content area", () => {
    renderWithAuthAndRouter(<AppLayout />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("keeps the active workspace identity visible in desktop and mobile chrome", () => {
    renderWithAuthAndRouter(<AppLayout />);

    expect(screen.getAllByText("Household budget")).toHaveLength(2);
  });

  it("Add Transaction button opens transaction modal", async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={["/dashboard"]}>
            <AuthContext.Provider value={makeAuthValue()}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<LocationDisplay />} />
                </Route>
              </Routes>
            </AuthContext.Provider>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>,
    );

    await userEvent.click(
      screen.getAllByRole("button", { name: /add transaction/i })[0],
    );

    expect(
      screen.getByRole("dialog", { name: /add transaction/i }),
    ).toBeInTheDocument();
  });
});
