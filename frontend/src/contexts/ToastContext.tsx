import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ToastViewport } from "@/components/ui/toast";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (
    message: string,
    variant?: ToastVariant,
    durationMs?: number,
  ) => number;
  dismissToast: (id?: number) => void;
  pauseToast: (id: number) => void;
  resumeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const MAX_VISIBLE_TOASTS = 4;
const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 10000,
};

interface ToastTimer {
  timeoutId: number | null;
  remainingMs: number;
  startedAt: number | null;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastsRef = useRef<ToastMessage[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ToastTimer>());

  const removeToasts = useCallback((nextToasts: ToastMessage[]) => {
    toastsRef.current = nextToasts;
    setToasts(nextToasts);
  }, []);

  const dismissToast = useCallback((id?: number) => {
    if (id === undefined) {
      for (const timer of timersRef.current.values()) {
        if (timer.timeoutId !== null) window.clearTimeout(timer.timeoutId);
      }
      timersRef.current.clear();
      toastsRef.current = [];
      setToasts([]);
      return;
    }

    const timer = timersRef.current.get(id);
    if (timer?.timeoutId !== null && timer?.timeoutId !== undefined) {
      window.clearTimeout(timer.timeoutId);
    }
    timersRef.current.delete(id);
    const nextToasts = toastsRef.current.filter((toast) => toast.id !== id);
    toastsRef.current = nextToasts;
    setToasts(nextToasts);
  }, []);

  const startTimer = useCallback(
    (id: number, remainingMs: number) => {
      const currentTimer = timersRef.current.get(id);
      if (
        currentTimer?.timeoutId !== null &&
        currentTimer?.timeoutId !== undefined
      ) {
        window.clearTimeout(currentTimer.timeoutId);
      }
      const safeRemainingMs = Math.max(0, remainingMs);
      const timeoutId = window.setTimeout(
        () => dismissToast(id),
        safeRemainingMs,
      );
      timersRef.current.set(id, {
        timeoutId,
        remainingMs: safeRemainingMs,
        startedAt: Date.now(),
      });
    },
    [dismissToast],
  );

  const pauseToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (!timer || timer.timeoutId === null || timer.startedAt === null) return;
    window.clearTimeout(timer.timeoutId);
    timersRef.current.set(id, {
      timeoutId: null,
      remainingMs: Math.max(
        0,
        timer.remainingMs - (Date.now() - timer.startedAt),
      ),
      startedAt: null,
    });
  }, []);

  const resumeToast = useCallback(
    (id: number) => {
      const timer = timersRef.current.get(id);
      if (!timer || timer.timeoutId !== null) return;
      if (!toastsRef.current.some((toast) => toast.id === id)) return;
      startTimer(id, timer.remainingMs);
    },
    [startTimer],
  );

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant = "success",
      durationMs?: number,
    ) => {
      const normalizedMessage = message.trim();
      const existingToast = toastsRef.current.find(
        (toast) =>
          toast.message === normalizedMessage && toast.variant === variant,
      );
      const minimumDuration = DEFAULT_DURATIONS[variant];
      const resolvedDuration =
        durationMs === undefined
          ? minimumDuration
          : Math.max(minimumDuration, durationMs);

      if (existingToast) {
        startTimer(existingToast.id, resolvedDuration);
        return existingToast.id;
      }

      const id = nextIdRef.current++;
      const nextToast = { id, message: normalizedMessage, variant };
      const combined = [...toastsRef.current, nextToast];
      const nextToasts = combined.slice(-MAX_VISIBLE_TOASTS);
      const removedIds = new Set(
        combined
          .slice(0, Math.max(0, combined.length - MAX_VISIBLE_TOASTS))
          .map((toast) => toast.id),
      );
      for (const removedId of removedIds) {
        const removedTimer = timersRef.current.get(removedId);
        if (
          removedTimer?.timeoutId !== null &&
          removedTimer?.timeoutId !== undefined
        ) {
          window.clearTimeout(removedTimer.timeoutId);
        }
        timersRef.current.delete(removedId);
      }
      removeToasts(nextToasts);
      startTimer(id, resolvedDuration);
      return id;
    },
    [removeToasts, startTimer],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        if (timer.timeoutId !== null) window.clearTimeout(timer.timeoutId);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast, pauseToast, resumeToast }),
    [toasts, showToast, dismissToast, pauseToast, resumeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismissToast}
        onPause={pauseToast}
        onResume={resumeToast}
      />
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
