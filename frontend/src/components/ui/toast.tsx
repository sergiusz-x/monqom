import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { ToastMessage, ToastVariant } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useRef } from "react";

const styles: Record<ToastVariant, string> = {
  error: "border-destructive/40 bg-destructive text-destructive-foreground",
  success: "border-success/40 bg-success text-success-foreground",
  info: "border-info/40 bg-info text-info-foreground",
  warning: "border-warning/40 bg-warning text-warning-foreground",
};

const icons = {
  error: CircleAlert,
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
};

interface ToastViewportProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
}

function ToastItem({ toast, onDismiss, onPause, onResume }: ToastItemProps) {
  const { t } = useTranslation();
  const pointerInsideRef = useRef(false);
  const focusInsideRef = useRef(false);
  const Icon = icons[toast.variant];
  const isAssertive = toast.variant === "error";

  return (
    <div
      data-slot="toast"
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg",
        styles[toast.variant],
      )}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
      onPointerEnter={() => {
        pointerInsideRef.current = true;
        onPause(toast.id);
      }}
      onPointerLeave={() => {
        pointerInsideRef.current = false;
        if (!focusInsideRef.current) onResume(toast.id);
      }}
      onFocusCapture={() => {
        focusInsideRef.current = true;
        onPause(toast.id);
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ) {
          return;
        }
        focusInsideRef.current = false;
        if (!pointerInsideRef.current) onResume(toast.id);
      }}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{toast.message}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="opacity-80 hover:opacity-100 focus-visible:ring-current"
        aria-label={t("common.dismissNotification")}
        onClick={() => onDismiss(toast.id)}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: ToastViewportProps) {
  const { t } = useTranslation();
  return (
    <div
      data-slot="toast-viewport"
      aria-label={t("common.notifications")}
      className="pointer-events-none fixed bottom-20 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-4"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onPause={onPause}
          onResume={onResume}
        />
      ))}
    </div>
  );
}
