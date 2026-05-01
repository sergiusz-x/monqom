import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Settings,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const leftItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", icon: Receipt },
];

const rightItems = [
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface BottomNavProps {
  onAddTransaction: () => void;
}

export default function BottomNav({ onAddTransaction }: BottomNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background flex items-center h-16"
      aria-label="Mobile navigation"
    >
      <div className="flex flex-1 items-center justify-around">
        {leftItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 text-xs",
                isActive ? "text-foreground" : "text-muted-foreground",
              )
            }
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      <button
        onClick={onAddTransaction}
        aria-label="Add Transaction"
        className="relative -mt-5 mx-2 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      <div className="flex flex-1 items-center justify-around">
        {rightItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 text-xs",
                isActive ? "text-foreground" : "text-muted-foreground",
              )
            }
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
