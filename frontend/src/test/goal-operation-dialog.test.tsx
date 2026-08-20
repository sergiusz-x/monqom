import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OperationDialog } from "@/pages/GoalDetailPage";

describe("OperationDialog", () => {
  it("opens with deposit selected and lets the user choose a withdrawal", async () => {
    const user = userEvent.setup();
    render(
      <OperationDialog
        open
        workspaceId="workspace-1"
        goalId="goal-1"
        currency="PLN"
        maxDate="2026-08-20"
        type="deposit"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Add operation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Deposit" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: "Withdrawal" }));

    expect(screen.getByRole("tab", { name: "Withdrawal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
