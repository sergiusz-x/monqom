import { useState } from "react";
import { EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usersApi } from "@/api/contract";
import type { User } from "@/contexts/AuthContext";
import { Alert, SectionCard } from "@monqom/ui";

interface PrivacySectionProps {
  user: User | null;
  setUser: (user: User | null) => void;
  onSaved: (message: string) => void;
}

export function PrivacySection({
  user,
  setUser,
  onSaved,
}: PrivacySectionProps) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(nextValue: boolean) {
    if (!user) return;

    setError(null);
    setIsSaving(true);
    try {
      const response = await usersApi.usersControllerUpdateMe({
        hide_salary_amounts: nextValue,
      });
      setUser(response.data as User);
      onSaved(t("privacy.saved"));
    } catch {
      setError(t("privacy.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionCard>
      <div className="flex gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <EyeOff size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t("privacy.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("privacy.description")}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <label
              htmlFor="hide-salary-amounts"
              className="text-sm font-medium"
            >
              {t("privacy.hideSalaryAmounts")}
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("privacy.hideSalaryAmountsDescription")}
            </p>
          </div>
          <input
            id="hide-salary-amounts"
            type="checkbox"
            role="switch"
            className="mt-0.5 size-5 accent-primary"
            checked={user?.hideSalaryAmounts ?? false}
            disabled={!user || isSaving}
            onChange={(event) => void save(event.target.checked)}
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {t("privacy.notAccessControl")}
      </p>
      {error ? (
        <Alert className="mt-4" variant="error">
          {error}
        </Alert>
      ) : null}
    </SectionCard>
  );
}
