import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { AuthCard } from "@/components/auth/AuthCard";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { getApiErrorMessage } from "@/lib/api-errors";

interface LoginFormValues {
  email: string;
  password: string;
}

interface TwoFactorFormValues {
  code: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, setUser } = useAuth();
  const navigate = useNavigate();
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [serverError, setServerError] = useState("");

  const loginForm = useForm<LoginFormValues>();
  const twoFactorForm = useForm<TwoFactorFormValues>();

  async function onLoginSubmit(data: LoginFormValues) {
    setServerError("");
    try {
      const result = await login(data.email, data.password);
      if (result.type === "two_factor_required") {
        setTwoFactorRequired(true);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      setServerError(msg);
    }
  }

  async function onTwoFactorSubmit(data: TwoFactorFormValues) {
    setServerError("");
    try {
      const res = await api.post<{
        id: string;
        email: string;
        name: string;
        emailVerified: boolean;
        totpEnabled: boolean;
        createdAt: string;
        updatedAt: string;
      }>("/auth/2fa/verify", { token: data.code });
      setUser(res.data);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setServerError(getApiErrorMessage(err));
    }
  }

  if (twoFactorRequired) {
    const {
      register,
      handleSubmit,
      formState: { errors, isSubmitting },
    } = twoFactorForm;
    return (
      <AuthCard>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("auth.twoFactor")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.twoFactorDescription")}
          </p>
        </div>
        <form onSubmit={handleSubmit(onTwoFactorSubmit)} className="space-y-4">
          <FormField
            id="code"
            label={t("auth.authenticationCode")}
            error={errors.code?.message}
            required
          >
            <Input
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="000000"
              {...register("code", { required: t("auth.codeRequired") })}
            />
          </FormField>
          {serverError && (
            <Alert variant="error" compact>
              {serverError}
            </Alert>
          )}
          <PendingButton
            type="submit"
            isPending={isSubmitting}
            pendingLabel={t("auth.verifyingAction")}
            className="w-full"
          >
            {t("auth.verify")}
          </PendingButton>
        </form>
      </AuthCard>
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = loginForm;
  return (
    <AuthCard>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.signIn")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.loginDescription")}
        </p>
      </div>
      <form onSubmit={handleSubmit(onLoginSubmit)} className="space-y-4">
        <FormField
          id="email"
          label={t("auth.email")}
          error={errors.email?.message}
          required
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            {...register("email", { required: t("auth.requiredEmail") })}
          />
        </FormField>
        <FormField
          id="password"
          error={errors.password?.message}
          required
          label={
            <span className="flex items-center justify-between">
              <span>{t("auth.password")}</span>
              <Link
                to="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                {t("auth.forgotPassword")}
              </Link>
            </span>
          }
        >
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register("password", {
              required: t("auth.requiredPassword"),
            })}
          />
        </FormField>
        {serverError && (
          <Alert variant="error" compact>
            {serverError}
          </Alert>
        )}
        <PendingButton
          type="submit"
          isPending={isSubmitting}
          pendingLabel={t("auth.signingIn")}
          className="w-full"
        >
          {t("auth.signIn")}
        </PendingButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="text-primary hover:underline">
          {t("auth.register")}
        </Link>
      </p>
    </AuthCard>
  );
}
