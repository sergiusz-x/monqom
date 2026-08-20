import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "destructive";
  disabled?: boolean;
}

export interface ActionMenuProps {
  ariaLabel: string;
  items: readonly ActionMenuItem[];
  disabled?: boolean;
  portalContainer?: ComponentProps<typeof Menu.Portal>["container"];
  triggerLabel?: string;
  triggerIcon?: LucideIcon;
}

export function ActionMenu({
  ariaLabel,
  items,
  disabled = false,
  portalContainer,
  triggerLabel,
  triggerIcon,
}: ActionMenuProps) {
  const TriggerIcon = triggerIcon ?? MoreHorizontal;

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={ariaLabel}
        disabled={disabled}
        className={buttonVariants({
          variant: triggerLabel ? "default" : "ghost",
          size: triggerLabel ? "default" : "icon",
        })}
      >
        <TriggerIcon size={19} aria-hidden="true" />
        {triggerLabel}
      </Menu.Trigger>
      <Menu.Portal container={portalContainer}>
        <Menu.Positioner
          sideOffset={4}
          align="end"
          className="z-[100] outline-none"
        >
          <Menu.Popup className="min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Menu.Item
                  key={item.id}
                  disabled={item.disabled}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                    item.tone === "destructive"
                      ? "text-destructive data-[highlighted]:bg-destructive/10"
                      : "data-[highlighted]:bg-muted",
                  )}
                  onClick={item.onSelect}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
