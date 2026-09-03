import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { authApi } from "@/api/contract";
import i18n from "@/i18n";
import { AuthCard } from "@/components/auth/AuthCard";
import { useTranslation } from "react-i18next";

import { getApiErrorMessage } from "@/lib/api-errors";
import { passwordValidationRules } from "@/lib/password-validation";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { turnstileConfigured } from "@/lib/turnstile";
import { Alert, FormField, Input, PendingButton } from "@monqom/ui";

interface RegisterFormValues {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetCount, setTurnstileResetCount] = useState(0);
  const onTurnstileTokenChange = useCallback(
    (token: string | null) => setTurnstileToken(token),
    [],
  );
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>();

  async function onSubmit(data: RegisterFormValues) {
    setServerError("");
    if (turnstileConfigured && !turnstileToken) {
      setServerError(t("auth.securityVerificationRequired"));
      return;
    }

    try {
      await authApi.authControllerRegister({
        email: data.email,
        name: data.name,
        password: data.password,
        locale: i18n.resolvedLanguage === "pl" ? "pl" : "en",
        base_currency: i18n.resolvedLanguage === "pl" ? "PLN" : "USD",
        turnstile_token: turnstileToken ?? undefined,
      });
      navigate("/verify-email", { replace: true });
    } catch (err: unknown) {
      setServerError(getApiErrorMessage(err));
      setTurnstileToken(null);
      setTurnstileResetCount((count) => count + 1);
    }
  }

  return (
    <AuthCard>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.signUp")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.registerDescription")}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          id="name"
          label={t("auth.name")}
          error={errors.name?.message}
          required
        >
          <Input
            type="text"
            autoComplete="name"
            placeholder={t("auth.namePlaceholder")}
            {...register("name", { required: t("auth.requiredName") })}
          />
        </FormField>
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
          label={t("auth.password")}
          error={errors.password?.message}
          required
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("password", {
              required: t("auth.requiredPassword"),
              ...passwordValidationRules(t),
            })}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label={t("auth.confirmPassword")}
          error={errors.confirmPassword?.message}
          required
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("confirmPassword", {
              required: t("auth.confirmRequired"),
              validate: (value) =>
                value === getValues("password") || t("auth.passwordMismatch"),
            })}
          />
        </FormField>
        {serverError && (
          <Alert variant="error" compact>
            {serverError}
          </Alert>
        )}
        <TurnstileWidget
          onTokenChange={onTurnstileTokenChange}
          resetCount={turnstileResetCount}
        />
        <PendingButton
          type="submit"
          isPending={isSubmitting}
          pendingLabel={t("auth.creating")}
          className="w-full"
          disabled={turnstileConfigured && !turnstileToken}
        >
          {t("auth.signUp")}
        </PendingButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthCard>
  );
}
