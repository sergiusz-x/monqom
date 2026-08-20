import { Badge } from "@monqom/ui";
import { useTranslation } from "react-i18next";

import type { GoalStatus } from "@/types/goal";

export function GoalStatusBadge({
  status,
  size = "default",
}: {
  status: GoalStatus;
  size?: "sm" | "default";
}) {
  const { t } = useTranslation();
  const tone =
    status === "completed"
      ? "success"
      : status === "overdue"
        ? "danger"
        : "default";

  return (
    <Badge tone={tone} size={size}>
      {t(`goals.${status}`)}
    </Badge>
  );
}
