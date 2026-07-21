import { useId } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { PendingButton } from "@/components/ui/pending-button";

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
