import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BudgetsPage from "@/pages/BudgetsPage";

vi.mock("@/hooks/useWorkspace", () => ({ useWorkspace: vi.fn() }));

vi.mock("@/components/CategorySelector", () => ({
  CategorySelector: ({
    onChange,
    value,
  }: {
    onChange: (id: string) => void;
    value: string | null;
  }) => (
    <button type="button" onClick={() => onChange("cat-1")}>
      {value ?? "Pick category"}
    </button>
  ),
}));

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

const mockUseWorkspace = useWorkspace as ReturnType<typeof vi.fn>;
const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const progressResponse = [
  {
    category_id: "cat-1",
    category_name: "Groceries",
    budget_amount: 500,
    limit: 500,
    spent: 300,
    remaining: 200,
    percentage: 60,
  },
  {
    category_id: "cat-2",
    category_name: "Taxi",
    budget_amount: null,
    limit: null,
    spent: 45,
    remaining: null,
    percentage: null,
  },
];

const budgetsResponse = [
  {
    id: "budget-1",
    category_id: "cat-1",
    amount: 500,
    year: 2026,
    month: 4,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseWorkspace.mockReturnValue({
    workspaceId: "ws-1",
    isLoading: false,
    error: null,
  });
  mockApi.get
    .mockResolvedValueOnce({ data: progressResponse })
    .mockResolvedValueOnce({ data: budgetsResponse });
});

describe("BudgetsPage", () => {
  it("navigates months with prev/next buttons", async () => {
    const user = userEvent.setup();
    render(<BudgetsPage />);

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(2));

    mockApi.get
      .mockResolvedValueOnce({ data: progressResponse })
      .mockResolvedValueOnce({ data: budgetsResponse });
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      const params = mockApi.get.mock.calls[2][1].params as { month: string };
      expect(params.month).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  it("creates a budget from add budget form", async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ data: {} });
    mockApi.get
      .mockResolvedValueOnce({ data: progressResponse })
      .mockResolvedValueOnce({ data: budgetsResponse });

    render(<BudgetsPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Add Budget" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Add Budget" }));
    await user.click(screen.getByRole("button", { name: "Pick category" }));
    await user.type(screen.getByLabelText("Amount"), "250");
    await user.click(screen.getByRole("button", { name: "Create budget" }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post.mock.calls[0][0]).toContain("/workspaces/ws-1/budgets");
    expect(mockApi.post.mock.calls[0][1]).toMatchObject({
      category_id: "cat-1",
      amount: 250,
    });
  });

  it("opens edit mode on budget click and supports delete", async () => {
    const user = userEvent.setup();
    mockApi.delete.mockResolvedValue({});
    mockApi.get
      .mockResolvedValueOnce({ data: progressResponse })
      .mockResolvedValueOnce({ data: budgetsResponse });

    render(<BudgetsPage />);

    await waitFor(() =>
      expect(screen.getByText("Groceries")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /groceries/i }));

    expect(
      screen.getByRole("heading", { name: "Edit budget" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete budget" }));

    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledTimes(1));
    expect(mockApi.delete.mock.calls[0][0]).toContain(
      "/workspaces/ws-1/budgets/budget-1",
    );
  });

  it("shows empty state when no budgets are defined", async () => {
    mockApi.get.mockReset();
    mockApi.get
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    render(<BudgetsPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No budgets defined for this month yet."),
      ).toBeInTheDocument();
    });
  });
});
