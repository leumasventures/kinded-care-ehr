import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { navItems } from "./Sidebar";
import { logAudit } from "../../services/audit";
import Header from "./Header";
import { EmergencyBanner } from "./EmergencyAccess";

// Pages whose records are already stored in the hospital database. Every other page still keeps its records in this browser
// only, and says so, until it is moved over.
const ON_DATABASE = ["/admin"];

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
        <EmergencyBanner />
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {!ON_DATABASE.some((p) => pathname.startsWith(p)) && (
            <p role="note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Not connected to the database yet: records on this page are saved in this browser only, and are not shared with other staff or backed up. Staff accounts, roles and the audit log are already stored in the database.
            </p>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
