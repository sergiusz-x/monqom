import { Outlet } from "react-router";
import PublicPreferences from "./PublicPreferences";
export default function PublicLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <PublicPreferences className="fixed right-3 top-3 z-50" />
      <Outlet />
    </div>
  );
}
