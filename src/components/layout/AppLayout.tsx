import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { navItems } from "./Sidebar";
import { logAudit } from "../../services/audit";
import Header from "./Header";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  // Record which areas of the system people open.
  useEffect(() => {
    const match = navItems
      .filter((i) => (i.path === "/" ? pathname === "/" : pathname.startsWith(i.path)))
      .sort((a, b) => b.path.length - a.path.length)[0];
    logAudit({ action: "View", module: match?.label ?? "App", summary: `Opened ${match?.label ?? pathname}` });
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}