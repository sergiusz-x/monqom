import { render, screen, fireEvent } from "@testing-library/react";
import { vi, it, expect } from "vitest";
import { SalaryPrivacyProvider, useSalaryPrivacy } from "@/contexts/SalaryPrivacyContext";

vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ user: { id: "user", hideSalaryAmounts: true, updatedAt: "1" } }) }));

function Example() {
  const { isRevealed, reveal, revealAll, setRevealAll, hideVersion } = useSalaryPrivacy();
  return <><span>{isRevealed("transaction") ? "visible" : "hidden"}</span><span data-testid="version">{hideVersion}</span><button onClick={() => reveal("transaction")}>reveal</button><button onClick={() => setRevealAll(!revealAll)}>toggle all</button></>;
}
it("hides individually revealed amounts when hiding all", () => {
  render(<SalaryPrivacyProvider><Example /></SalaryPrivacyProvider>);
  fireEvent.click(screen.getByText("reveal"));
  expect(screen.getByText("visible")).toBeTruthy();
  fireEvent.click(screen.getByText("toggle all"));
  fireEvent.click(screen.getByText("toggle all"));
  expect(screen.getByText("hidden")).toBeTruthy();
  expect(screen.getByTestId("version").textContent).toBe("1");
});
