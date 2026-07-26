import { type ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "./button";
import type { ReactNode } from "react";

interface PendingButtonProps extends ComponentProps<typeof Button> {
  isPending: boolean;
  pendingLabel: ReactNode;
}

/**
 * Button that shows a spinner and pending label while an async action is in
 * progress, and is automatically disabled + aria-busy during that time.
 *
 * @example
 * ```tsx
 * <PendingButton
 *   isPending={isSaving}
 *   pendingLabel="Saving…"
 *   onClick={handleSave}
 * >
 *   Save
 * </PendingButton>
 * ```
 */
export function PendingButton({
  isPending,
  pendingLabel,
  disabled,
  children,
  ...props
}: PendingButtonProps) {
  return (
    <Button
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      {...props}
    >
      {isPending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
