import { fireEvent, render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";

import { ActionMenu } from "./action-menu";
import { Badge } from "./badge";
import { ProgressBar } from "./progress-bar";
import { SegmentedControl } from "./segmented-control";

describe("shared UI primitives", () => {
  it("clamps progress values and exposes accessible state", () => {
    render(<ProgressBar value={140} ariaLabel="Savings progress" />);

    const progress = screen.getByRole("progressbar", {
      name: "Savings progress",
    });
    expect(progress).toHaveAttribute("aria-valuenow", "100");
    expect(progress).toHaveStyle({ width: "100%" });
  });

  it("reports segmented-control changes", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="active"
        ariaLabel="Goal view"
        options={[
          { value: "active", label: "Active" },
          { value: "archived", label: "Archived" },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Archived" }));
    expect(onChange).toHaveBeenCalledWith("archived");
  });

  it("applies shared badge tones", () => {
    render(<Badge tone="success">Completed</Badge>);
    expect(screen.getByText("Completed")).toHaveClass("text-emerald-700");
  });

  it("supports a labelled primary action-menu trigger", () => {
    render(
      <ActionMenu
        ariaLabel="Add operation"
        triggerLabel="Add operation"
        triggerIcon={Plus}
        items={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add operation" }),
    ).toHaveTextContent("Add operation");
  });
});
