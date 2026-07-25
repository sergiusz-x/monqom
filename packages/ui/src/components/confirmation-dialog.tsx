import { useId } from "react";
import { Modal } from "./modal";
import { Button } from "./button";
import { FieldError } from "./field-error";
import { PendingButton } from "./pending-button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel?: string;
  isPending?: boolean;
  error?: string | null;
  layer?: "default" | "nested";
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Accessible confirmation dialog with destructive confirm action.
 *
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   open={isOpen}
 *   title="Delete transaction"
 *   description="This cannot be undone."
 *   confirmLabel="Delete"
 *   cancelLabel="Cancel"
 *   isPending={isDeleting}
 *   onConfirm={handleDelete}
 *   onClose={() => setOpen(false)}
 * />
 * ```
 */
export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  isPending = false,
  error,
  layer = "default",
  onConfirm,
  onClose,
}: ConfirmationDialogProps) {
  const generatedId = useId().replaceAll(":", "");
  const titleId = `confirmation-title-${generatedId}`;
  const descriptionId = `confirmation-description-${generatedId}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventClose={isPending}
      layer={layer}
      ariaLabelledBy={titleId}
      ariaDescribedBy={descriptionId}
      contentClassName="max-w-md"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
        {description}
      </p>
      <FieldError message={error} className="mt-3 text-sm" />
      <div className="mt-5 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={onClose}
        >
          {cancelLabel}
        </Button>
        <PendingButton
          type="button"
          variant="destructive"
          isPending={isPending}
          pendingLabel={pendingLabel ?? confirmLabel}
          onClick={onConfirm}
        >
          {confirmLabel}
        </PendingButton>
      </div>
    </Modal>
  );
}
