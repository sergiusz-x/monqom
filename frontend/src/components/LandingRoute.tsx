import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

export default function LandingRoute() {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">
          {t("common.loading")}
        </span>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
