import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import GoalFormPage from "@/pages/GoalFormPage";
import { renderWithQueryClient as render } from "@/test/query-test-utils";

vi.mock("@/hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    workspaceId: "workspace-1",
    workspace: {
      id: "workspace-1",
      name: "Home",
      timezone: "Europe/Warsaw",
      baseCurrency: "PLN",
      lastPaymentSourceId: null,
      baseCurrencyLocked: false,
    },
    workspaces: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    patchWorkspace: vi.fn(),
    setActiveWorkspace: vi.fn(),
  }),
}));

describe("GoalFormPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-31T22:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes the target date from the workspace-local day", async () => {
    render(
      <MemoryRouter initialEntries={["/goals/new"]}>
        <GoalFormPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Target date")).toHaveValue("2027-09-01"),
    );
  });
});
