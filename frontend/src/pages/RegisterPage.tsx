import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import i18n from "@/i18n";
import { AuthCard } from "@/components/auth/AuthCard";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { getApiErrorMessage } from "@/lib/api-errors";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

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
    try {
      await api.post("/auth/register", {
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
              minLength: { value: 8, message: t("auth.minPassword") },
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
        <TurnstileWidget onTokenChange={onTurnstileTokenChange} />
        <PendingButton
          type="submit"
          isPending={isSubmitting}
          pendingLabel={t("auth.creating")}
          className="w-full"
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
