import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface ReleaseVersionData {
  version: string;
  sha: string;
}

export function ReleaseVersion() {
  const { t } = useTranslation();
  const [release, setRelease] = useState<ReleaseVersionData | null>(null);

  useEffect(() => {
    void fetch("/version.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ReleaseVersionData;
      })
      .then(setRelease)
      .catch(() => setRelease(null));
  }, []);

  if (!release?.version) return null;

  return (
    <span
      className="text-xs text-muted-foreground"
      title={release.sha ? release.sha.slice(0, 12) : undefined}
    >
      {t("common.versionPrefix")}
      {release.version}
    </span>
  );
}
