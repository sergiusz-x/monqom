import { useCallback } from "react";
import { useToastContext, type ToastVariant } from "@/contexts/ToastContext";

export function useToast(durationMs?: number) {
  const {
    toasts,
    showToast: showGlobalToast,
    dismissToast,
  } = useToastContext();

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      return showGlobalToast(message, variant, durationMs);
    },
    [durationMs, showGlobalToast],
  );

  return { toast: toasts.at(-1) ?? null, toasts, showToast, dismissToast };
}
