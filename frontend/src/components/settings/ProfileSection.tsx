import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { type User } from "@/contexts/AuthContext";
import i18n, { type AppTranslationKey } from "@/i18n";
import { SectionCard } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { Select } from "@/components/ui/select";
import { useFocusOnError } from "@/hooks/useFocusOnError";
interface ProfileSectionProps {
  user: User | null;
  setUser: (user: User | null) => void;
  onSaved: (message: string) => void;
}
function validateDisplayName(name: string): AppTranslationKey | null {
  const normalizedName = name.trim();
  if (normalizedName.length === 0) return "settings.displayNameRequired";
  if (normalizedName.length < 2) return "settings.displayNameShort";
  if (normalizedName.length > 100) return "settings.displayNameLong";
  return null;
}
export function ProfileSection({
  user,
  setUser,
  onSaved,
}: ProfileSectionProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [locale, setLocale] = useState<"en" | "pl">(user?.locale ?? "en");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const formRef = useFocusOnError(profileError);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setProfileError(t(validationError));
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);

    try {
      const res = await api.put<User>("/users/me", {
        name: displayName.trim(),
        locale,
      });
      await i18n.changeLanguage(locale);
      setUser(res.data);
      onSaved(t("settings.profileSaved"));
    } catch {
      setProfileError(t("settings.profileSaveError"));
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <SectionCard>
      <h2 className="text-lg font-semibold">{t("settings.profile")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings.profileDescription")}
      </p>
      <form
        ref={formRef}
        className="mt-5 max-w-xl space-y-4"
        onSubmit={handleProfileSave}
      >
        <FormField
          id="display-name"
          label={t("settings.displayName")}
          error={profileError}
          required
        >
          <Input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </FormField>
        <FormField
          id="profile-language"
          label={t("settings.language")}
          required
        >
          <Select
            value={locale}
            onChange={(event) => setLocale(event.target.value as "en" | "pl")}
          >
            <option value="en">{t("settings.english")}</option>
            <option value="pl">{t("settings.polish")}</option>
          </Select>
        </FormField>{" "}
        <PendingButton
          type="submit"
          isPending={isSavingProfile}
          pendingLabel={t("settings.saving")}
        >
          {t("settings.saveProfile")}
        </PendingButton>
      </form>
    </SectionCard>
  );
}
