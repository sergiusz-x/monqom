import { Link, Outlet } from "react-router-dom";
import MonqomLogo from "@/components/MonqomLogo";
import PublicPreferences from "./PublicPreferences";
import { ReleaseVersion } from "@/components/ReleaseVersion";

export default function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MonqomLogo size={28} className="text-foreground" />
            <span className="text-lg font-semibold tracking-tight">Monqom</span>
          </Link>
          <PublicPreferences />
        </div>
      </header>
      <main className="flex flex-1">
        <Outlet />
      </main>
      <footer className="px-4 py-2 text-right">
        <ReleaseVersion />
      </footer>
    </div>
  );
}
