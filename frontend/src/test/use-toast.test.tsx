import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useToast } from "@/hooks/useToast";
import { ToastProvider } from "@/contexts/ToastContext";

function ToastHarness() {
  const { showToast } = useToast();
  return (
    <>
      <button type="button" onClick={() => showToast("Saved", "success")}>
        Success
      </button>
      <button type="button" onClick={() => showToast("Failed", "error")}>
        Error
      </button>
    </>
  );
}

describe("useToast", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("deduplicates equal notifications and limits the visible queue", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    let firstId = 0;
    let duplicateId = 0;
    act(() => {
      firstId = result.current.showToast("Same", "info");
      duplicateId = result.current.showToast("Same", "info");
      result.current.showToast("Second", "info");
      result.current.showToast("Third", "info");
      result.current.showToast("Fourth", "info");
      result.current.showToast("Fifth", "info");
    });

    expect(duplicateId).toBe(firstId);
    expect(result.current.toasts.map((toast) => toast.message)).toEqual([
      "Second",
      "Third",
      "Fourth",
      "Fifth",
    ]);
  });

  it("uses polite and assertive live regions with longer error visibility", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    const success = screen.getByRole("status");
    expect(success).toHaveAttribute("aria-live", "polite");
    expect(success).toHaveAttribute("aria-atomic", "true");
    expect(success).toHaveClass("bg-success", "text-success-foreground");
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Error" }));
    const error = screen.getByRole("alert");
    expect(error).toHaveAttribute("aria-live", "assertive");
    act(() => vi.advanceTimersByTime(9999));
    expect(screen.getByText("Failed")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("pauses and resumes the remaining timer during pointer interaction", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    const toast = screen.getByRole("status");

    act(() => vi.advanceTimersByTime(1000));
    fireEvent.pointerEnter(toast);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    fireEvent.pointerLeave(toast);
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("pauses while the dismiss action contains keyboard focus", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    const dismissButton = screen.getByRole("button", {
      name: "Dismiss notification",
    });

    fireEvent.focus(dismissButton);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    fireEvent.blur(dismissButton);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("clears active timers when the provider unmounts", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { result, unmount } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    act(() => result.current.showToast("First"));
    act(() => result.current.showToast("Second"));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });
});
