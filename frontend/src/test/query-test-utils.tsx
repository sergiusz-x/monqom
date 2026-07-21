import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  renderHook,
  type RenderHookOptions,
  type RenderOptions,
} from "@testing-library/react";
import { ToastProvider } from "@/contexts/ToastContext";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  });
}

export function renderWithQueryClient(
  ui: React.ReactNode,
  options: RenderOptions = {},
) {
  const client = createTestQueryClient();
  const ExistingWrapper = options.wrapper;

  function Wrapper({ children }: { children: ReactNode }) {
    const content = ExistingWrapper ? (
      <ExistingWrapper>{children}</ExistingWrapper>
    ) : (
      children
    );
    return (
      <QueryClientProvider client={client}>
        <ToastProvider>{content}</ToastProvider>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { ...options, wrapper: Wrapper }),
    queryClient: client,
  };
}

export function renderHookWithQueryClient<Result, Props>(
  callback: (props: Props) => Result,
  options: RenderHookOptions<Props> = {},
) {
  const client = createTestQueryClient();
  const ExistingWrapper = options.wrapper;

  function Wrapper({ children }: { children: ReactNode }) {
    const content = ExistingWrapper ? (
      <ExistingWrapper>{children}</ExistingWrapper>
    ) : (
      children
    );
    return <QueryClientProvider client={client}>{content}</QueryClientProvider>;
  }

  return {
    ...renderHook(callback, { ...options, wrapper: Wrapper }),
    queryClient: client,
  };
}
