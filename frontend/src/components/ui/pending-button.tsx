import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingButtonProps extends ComponentProps<typeof Button> {
  isPending: boolean;
  pendingLabel: ReactNode;
}

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
