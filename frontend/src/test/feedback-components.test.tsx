import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";
import { StateMessage } from "@/components/ui/state-message";
import { Button } from "@/components/ui/button";
import { AsyncState } from "@/components/ui/async-state";
import { EmptyState } from "@/components/ui/empty-state";
import { PendingButton } from "@/components/ui/pending-button";

describe("feedback components", () => {
  it("uses alert semantics for errors", () => {
    render(<Alert variant="error">Something went wrong</Alert>);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("uses status semantics for informational messages", () => {
    render(<Alert variant="info">Saved for later</Alert>);

    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("Saved for later");
    expect(alert).toHaveClass("border-info/30", "bg-info/10", "text-info");
  });

  it("uses shared semantic tokens for success and warning alerts", () => {
    const { rerender } = render(<Alert variant="success">Saved</Alert>);
    expect(screen.getByRole("status")).toHaveClass(
      "bg-success/10",
      "text-success",
    );

    rerender(<Alert variant="warning">Review this</Alert>);
    expect(screen.getByRole("status")).toHaveClass(
      "bg-warning/10",
      "text-warning",
    );
  });

  it("renders a field error only when a message exists", () => {
    const { rerender } = render(<FieldError />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<FieldError message="Amount is required" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Amount is required");
  });

  it("announces loading states", () => {
    render(<StateMessage variant="loading">Loading data</StateMessage>);

    expect(screen.getByRole("status")).toHaveTextContent("Loading data");
  });

  it("applies consistent pointer, disabled, focus, and mobile target styles", () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button).toHaveClass("cursor-pointer", "disabled:cursor-not-allowed");
    expect(button).toHaveClass("focus-visible:ring-3", "max-sm:min-h-11");
    expect(button).toBeDisabled();
  });

  it("announces a stable skeleton without collapsing the content area", () => {
    render(<AsyncState status="loading" message="Loading transactions" />);
    const state = screen.getByRole("status", { name: "Loading transactions" });
    expect(state).toHaveClass("min-h-32");
    expect(state.querySelectorAll("[aria-hidden='true']")).toHaveLength(3);
  });

  it("offers retry from the shared error state", async () => {
    const retry = vi.fn();
    render(
      <AsyncState status="error" message="Could not load" onRetry={retry} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("renders a shared empty state with a useful CTA", async () => {
    const action = vi.fn();
    render(
      <EmptyState
        title="Nothing here"
        actionLabel="Add item"
        onAction={action}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(action).toHaveBeenCalledOnce();
  });

  it("uses one accessible pending treatment for mutations", () => {
    render(
      <PendingButton isPending pendingLabel="Saving…">
        Save
      </PendingButton>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
