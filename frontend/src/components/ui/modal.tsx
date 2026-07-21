import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  contentClassName?: string;
  layer?: "default" | "nested";
  preventClose?: boolean;
  contentRef?: Ref<HTMLDivElement>;
}

export function Modal({
  open,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  contentClassName,
  layer = "default",
  preventClose = false,
  contentRef,
}: ModalProps) {
  const layerClassName = layer === "nested" ? "z-[70]" : "z-50";

  return (
    <Dialog.Root
      open={open}
      disablePointerDismissal={preventClose}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !preventClose) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="modal-backdrop"
          className={cn("fixed inset-0 bg-black/50", layerClassName)}
        />
        <Dialog.Viewport
          data-slot="modal-viewport"
          className={cn(
            "fixed inset-0 flex items-center justify-center overflow-y-auto p-4",
            layerClassName,
          )}
        >
          <Dialog.Popup
            ref={contentRef}
            data-slot="modal-content"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            className={cn(
              "w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl outline-none",
              contentClassName,
            )}
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
