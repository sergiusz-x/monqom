import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "@/i18n";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    reportClientError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-semibold">{i18n.t("common.error")}</h1>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
              onClick={() => window.location.assign("/")}
            >
              {i18n.t("common.retry")}
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

function reportClientError(): void {
  // Deliberately omit the error message, stack, URL and user data.
  console.error("Client rendering error");
}
