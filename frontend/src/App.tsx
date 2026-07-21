import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import MarketingLayout from "@/components/layout/MarketingLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LandingRoute from "@/components/LandingRoute";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ToastProvider } from "@/contexts/ToastContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const TransactionDetailPage = lazy(
  () => import("@/pages/TransactionDetailPage"),
);
const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"));
const PaymentSourcesPage = lazy(() => import("@/pages/PaymentSourcesPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const ResendVerificationPage = lazy(
  () => import("@/pages/ResendVerificationPage"),
);

function lazyRoute(page: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{page}</Suspense>;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
              <AuthProvider>
                <Routes>
                  <Route element={<LandingRoute />}>
                    <Route element={<MarketingLayout />}>
                      <Route path="/" element={lazyRoute(<LandingPage />)} />
                    </Route>
                  </Route>
                  <Route element={<PublicLayout />}>
                    <Route path="/login" element={lazyRoute(<LoginPage />)} />
                    <Route
                      path="/register"
                      element={lazyRoute(<RegisterPage />)}
                    />
                    <Route
                      path="/verify-email"
                      element={lazyRoute(<VerifyEmailPage />)}
                    />
                    <Route
                      path="/forgot-password"
                      element={lazyRoute(<ForgotPasswordPage />)}
                    />
                    <Route
                      path="/reset-password"
                      element={lazyRoute(<ResetPasswordPage />)}
                    />
                    <Route
                      path="/resend-verification"
                      element={lazyRoute(<ResendVerificationPage />)}
                    />
                  </Route>
                  <Route element={<ProtectedRoute />}>
                    <Route
                      element={
                        <WorkspaceProvider>
                          <AppLayout />
                        </WorkspaceProvider>
                      }
                    >
                      <Route
                        path="/dashboard"
                        element={lazyRoute(<DashboardPage />)}
                      />
                      <Route
                        path="/transactions"
                        element={lazyRoute(<TransactionsPage />)}
                      />
                      <Route
                        path="/transactions/:transactionId"
                        element={lazyRoute(<TransactionDetailPage />)}
                      />
                      <Route
                        path="/budgets"
                        element={lazyRoute(<BudgetsPage />)}
                      />
                      <Route
                        path="/payment-sources"
                        element={lazyRoute(<PaymentSourcesPage />)}
                      />
                      <Route
                        path="/settings"
                        element={lazyRoute(<SettingsPage />)}
                      />
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
