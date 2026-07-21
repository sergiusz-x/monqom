import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { AuthCard } from "@/components/auth/AuthCard";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { getApiErrorMessage } from "@/lib/api-errors";

type Status = "pending" | "loading" | "success" | "error" | "no_token";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "no_token");
  const [message, setMessage] = useState("");
  const didVerify = useRef(false);

  useEffect(() => {
    if (!token || didVerify.current) return;
    didVerify.current = true;

    api
      .post("/auth/verify-email", { token })
      .then(() => {
        setMessage("");
        setStatus("success");
      })
      .catch((err: unknown) => {
        const msg = getApiErrorMessage(err, t("auth.invalidVerification"));
        setMessage(msg);
        setStatus("error");
      });
  }, [t, token]);

  return (
    <AuthCard centered>
      {status === "loading" && (
        <>
          <h1 className="text-2xl font-semibold">{t("auth.verifying")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.pleaseWait")}
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <h1 className="text-2xl font-semibold">{t("auth.verified")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.verifiedDescription")}
          </p>
          <Link
            to="/login"
            className="inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t("auth.signIn")}
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-2xl font-semibold">
            {t("auth.verificationFailed")}
          </h1>
          <Alert variant="error" compact>
            {message || t("auth.invalidVerification")}
          </Alert>
          <p className="text-sm text-muted-foreground">
            {t("auth.didntReceive")}{" "}
            <Link
              to="/resend-verification"
              className="text-primary hover:underline"
            >
              {t("auth.resend")}
            </Link>
          </p>
        </>
      )}

      {status === "no_token" && (
        <>
          <h1 className="text-2xl font-semibold">{t("auth.checkEmail")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.verificationSent")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("auth.didntReceive")}{" "}
            <Link
              to="/resend-verification"
              className="text-primary hover:underline"
            >
              {t("auth.resend")}
            </Link>
          </p>
        </>
      )}
    </AuthCard>
  );
}
