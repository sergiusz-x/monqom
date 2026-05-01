import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";

type Status = "pending" | "loading" | "success" | "error" | "no_token";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "no_token");
  const [message, setMessage] = useState("");
  const didVerify = useRef(false);

  useEffect(() => {
    if (!token || didVerify.current) return;
    didVerify.current = true;

    api
      .post<{ message: string }>("/auth/verify-email", { token })
      .then((res) => {
        setMessage(res.data.message);
        setStatus("success");
      })
      .catch((err: unknown) => {
        const msg = extractErrorMessage(err);
        setMessage(msg);
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card text-center">
        {status === "loading" && (
          <>
            <h1 className="text-2xl font-semibold">Verifying your email</h1>
            <p className="text-sm text-muted-foreground">Please wait…</p>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-semibold">Email verified</h1>
            <p className="text-sm text-muted-foreground">
              {message || "Your email has been verified."}
            </p>
            <Link
              to="/login"
              className="inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign in
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-semibold">Verification failed</h1>
            <p className="text-sm text-destructive">
              {message || "The verification link is invalid or has expired."}
            </p>
            <p className="text-sm text-muted-foreground">
              Need a new link?{" "}
              <Link
                to="/resend-verification"
                className="text-primary hover:underline"
              >
                Resend verification email
              </Link>
            </p>
          </>
        )}

        {status === "no_token" && (
          <>
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to your email address. Click the link
              to verify your account.
            </p>
            <p className="text-sm text-muted-foreground">
              Didn't receive it?{" "}
              <Link
                to="/resend-verification"
                className="text-primary hover:underline"
              >
                Resend verification email
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function extractErrorMessage(err: unknown): string {
  if (
    err &&
    typeof err === "object" &&
    "response" in err &&
    err.response &&
    typeof err.response === "object" &&
    "data" in err.response
  ) {
    const data = (err.response as { data: unknown }).data;
    if (data && typeof data === "object" && "message" in data) {
      const msg = (data as { message: unknown }).message;
      return Array.isArray(msg) ? msg.join(", ") : String(msg);
    }
  }
  return "Verification failed. Please try again.";
}
