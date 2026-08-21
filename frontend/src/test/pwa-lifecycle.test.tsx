import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PwaLifecycle } from "@/components/PwaLifecycle";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  useRegisterSW: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: mocks.useRegisterSW,
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

describe("PwaLifecycle", () => {
  beforeEach(() => {
    mocks.showToast.mockReset();
    mocks.useRegisterSW.mockReset();
  });

  it("checks for a new service worker when the app regains focus", async () => {
    let registrationCallback:
      | ((url: string, registration?: ServiceWorkerRegistration) => void)
      | undefined;
    const update = vi.fn().mockResolvedValue(undefined);

    mocks.useRegisterSW.mockImplementation((options) => {
      registrationCallback = options.onRegisteredSW;
      return {
        needRefresh: [false, vi.fn()],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: vi.fn(),
      };
    });

    render(<PwaLifecycle />);
    expect(mocks.useRegisterSW).toHaveBeenCalledWith(
      expect.objectContaining({ immediate: true }),
    );

    act(() => {
      registrationCallback?.("/sw.js", {
        update,
      } as unknown as ServiceWorkerRegistration);
    });
    fireEvent.focus(window);

    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
