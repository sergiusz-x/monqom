import { Outlet } from "react-router-dom";
import PublicPreferences from "./PublicPreferences";
import { ReleaseVersion } from "@/components/ReleaseVersion";

export default function PublicLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <PublicPreferences className="fixed right-3 top-3 z-50" />
      <div className="fixed bottom-3 right-3">
        <ReleaseVersion />
      </div>
      <Outlet />
    </div>
  );
}
