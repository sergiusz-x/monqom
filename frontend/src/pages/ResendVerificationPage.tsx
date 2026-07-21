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

interface FormValues {
  email: string;
}

export default function ResendVerificationPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  async function onSubmit(data: FormValues) {
    setServerError("");
    try {
      await api.post("/auth/resend-verification", { email: data.email });
      setSubmitted(true);
    } catch {
      setServerError(t("auth.genericError"));
    }
  }

  if (submitted) {
    return (
      <AuthCard compact centered>
        <h1 className="text-2xl font-semibold">{t("auth.emailSent")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.verificationResent")}
        </p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.resendTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.resendDescription")}
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
          {t("auth.resendAction")}
        </PendingButton>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-primary hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </AuthCard>
  );
}
