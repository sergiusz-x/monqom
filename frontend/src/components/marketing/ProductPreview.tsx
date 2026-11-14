import { useState } from "react";
import { Expand } from "lucide-react";
import { Card } from "@monqom/ui";
import { ScreenshotDialog } from "@/components/ScreenshotDialog";

import { cn } from "@/lib/utils";

interface ProductPreviewProps {
  src: string;
  alt: string;
  openLabel: string;
  closeLabel: string;
  className?: string;
  portrait?: boolean;
}

/**
 * Reusable product screenshot treatment for marketing pages.
 * The compact view intentionally crops to a presentation-friendly ratio,
 * while the dialog always exposes the original, full screenshot.
 */
export function ProductPreview({
  src,
  alt,
  openLabel,
  closeLabel,
  className,
  portrait = false,
}: ProductPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(
          "group relative block w-full cursor-zoom-in rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
        aria-label={openLabel}
        onClick={() => setIsOpen(true)}
      >
        <Card
          padding="none"
          elevation="raised"
          className="overflow-hidden bg-card transition duration-200 group-hover:border-primary/50 group-hover:shadow-md"
        >
          <div className="flex h-9 items-center gap-1.5 border-b border-border bg-muted/40 px-3">
            <span className="size-2 rounded-full bg-[#ff5f57]" />
            <span className="size-2 rounded-full bg-[#febc2e]" />
            <span className="size-2 rounded-full bg-[#28c840]" />
            <span className="ml-3 h-4 w-28 rounded-full bg-foreground/10" />
          </div>
          <div
            className={cn(
              "relative overflow-hidden bg-background",
              portrait ? "aspect-[9/16]" : "aspect-[16/10]",
            )}
          >
            <img
              src={src}
              alt={alt}
              className="block size-full object-cover object-top"
            />
            <span className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-lg border border-border bg-background/90 text-foreground opacity-80 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
              <Expand size={17} aria-hidden="true" />
            </span>
          </div>
        </Card>
      </button>

      <ScreenshotDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        src={src}
        alt={alt}
        closeLabel={closeLabel}
      />
    </>
  );
}
