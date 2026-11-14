import { X } from "lucide-react";
import { Button, Card, Modal } from "@monqom/ui";

interface ScreenshotDialogProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  closeLabel: string;
}

export function ScreenshotDialog({
  open,
  onClose,
  src,
  alt,
  closeLabel,
}: ScreenshotDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={alt}
      contentClassName="max-w-6xl overflow-visible border-0 bg-transparent p-0 shadow-none"
    >
      <div className="relative">
        <Card
          padding="none"
          elevation="raised"
          className="overflow-hidden bg-card"
        >
          <img
            src={src}
            alt=""
            className="block max-h-[calc(100dvh-5rem)] w-full object-contain"
          />
        </Card>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute -right-2 -top-2 rounded-full bg-background shadow-sm"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={17} aria-hidden="true" />
        </Button>
      </div>
    </Modal>
  );
}
