import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { AuthCard } from "@/components/auth/AuthCard";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { getApiErrorMessage } from "@/lib/api-errors";

interface ResetPasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>();

  if (!token) {
    return (
      <AuthCard compact centered>
        <h1 className="text-2xl font-semibold">{t("auth.invalidLink")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.missingResetToken")}
        </p>
        <Link
          to="/forgot-password"
          className="text-sm text-primary hover:underline"
        >
          {t("auth.requestNewLink")}
        </Link>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard compact centered>
        <h1 className="text-2xl font-semibold">{t("auth.resetDone")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.resetSuccessDescription")}
        </p>
        <Link
          to="/login"
          className="inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {t("auth.signIn")}
        </Link>
      </AuthCard>
    );
  }

  async function onSubmit(data: ResetPasswordFormValues) {
    setServerError("");
    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setServerError(getApiErrorMessage(err));
    }
  }

  return (
    <AuthCard>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("auth.resetTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.resetDescription")}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          id="newPassword"
          label={t("auth.newPassword")}
          error={errors.newPassword?.message}
          required
        >
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            {...register("newPassword", {
              required: t("auth.requiredNewPassword"),
              minLength: { value: 8, message: t("auth.minPassword") },
            })}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label={t("auth.confirmNewPassword")}
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
                value === getValues("newPassword") ||
                t("auth.passwordMismatch"),
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
          pendingLabel={t("settings.saving")}
          className="w-full"
        >
          {t("auth.resetTitle")}
        </PendingButton>
      </form>
    </AuthCard>
  );
}
