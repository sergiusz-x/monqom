import { Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

interface WorkspaceSwitcherProps {
  compact?: boolean;
  className?: string;
}

export function WorkspaceSwitcher({
  compact = false,
  className,
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation();
  const { workspaces, workspaceId, workspace, setActiveWorkspace } =
    useWorkspace();

  if (!workspace) return null;

  if (workspaces.length <= 1) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 text-sm font-medium",
          className,
        )}
      >
        <Building2
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate">{workspace.name}</span>
      </div>
    );
  }

  return (
    <label className={cn("flex min-w-0 items-center gap-2", className)}>
      <Building2
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="sr-only">{t("workspaceSwitcher.label")}</span>
      <Select
        value={workspaceId ?? ""}
        onChange={(event) => setActiveWorkspace(event.target.value)}
        className={cn(
          "min-w-0 flex-1 truncate rounded-md border border-input bg-background text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
          compact ? "h-8 px-2" : "h-9 px-3",
        )}
        aria-label={t("workspaceSwitcher.label")}
      >
        {workspaces.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
