import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { AuthCard } from "@/components/auth/AuthCard";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { getApiErrorStatus } from "@/lib/api-errors";

interface ForgotPasswordFormValues {
  email: string;
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>();

  async function onSubmit(data: ForgotPasswordFormValues) {
    setServerError("");
    try {
      await api.post("/auth/forgot-password", { email: data.email });
      setSubmitted(true);
    } catch (err: unknown) {
      // Backend intentionally returns success for unknown emails to prevent enumeration.
      // If an unexpected error occurs, show a generic message.
      const status = getApiErrorStatus(err) ?? 0;

      if (status >= 500) {
        setServerError(t("auth.genericError"));
      } else {
        setSubmitted(true);
      }
    }
  }

  if (submitted) {
    return (
      <AuthCard compact centered>
        <h1 className="text-2xl font-semibold">{t("auth.checkEmail")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.sentReset")}</p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.forgotTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.forgotDescription")}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        {serverError && (
          <Alert variant="error" compact>
            {serverError}
          </Alert>
        )}
        <PendingButton
          type="submit"
          isPending={isSubmitting}
          pendingLabel={t("auth.sending")}
          className="w-full"
        >
          {t("auth.sendReset")}
        </PendingButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.remembered")}{" "}
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </AuthCard>
  );
}
