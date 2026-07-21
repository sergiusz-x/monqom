import type { ReactNode } from "react";
import MonqomLogo from "@/components/MonqomLogo";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface AuthCardProps {
  children: ReactNode;
  compact?: boolean;
  centered?: boolean;
  showBrand?: boolean;
}

export function AuthCard({
  children,
  compact = false,
  centered = false,
  showBrand = true,
}: AuthCardProps) {
  return (
    <Card
      padding="spacious"
      elevation="raised"
      className={cn(
        "w-full max-w-sm",
        compact ? "space-y-4" : "space-y-6",
        centered && "text-center",
      )}
    >
      {showBrand && (
        <div className="flex flex-col items-center gap-2 pb-2">
          <MonqomLogo size={36} className="text-foreground" />
          <span className="text-xl font-semibold tracking-tight">Monqom</span>
        </div>
      )}
      {children}
    </Card>
  );
}
