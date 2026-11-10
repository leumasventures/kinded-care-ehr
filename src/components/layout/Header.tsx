import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Bell, Search, LogOut } from "lucide-react";
import { navItems } from "./Sidebar";
import { useAuth } from "../../context/AuthContext";
import { EmergencyButton } from "./EmergencyAccess";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");

  const current =
    navItems.find((item) =>
      item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)
    )?.label ?? "Dashboard";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open sidebar"
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <h1 className="text-lg font-semibold text-slate-800">{current}</h1>

      <div className="ml-auto flex items-center gap-3">
        <EmergencyButton />
        <div className="relative hidden md:block">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients, records..."
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          aria-label="Notifications"
          className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
        >
          <Bell size={20} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            {user?.name.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium leading-tight text-slate-800">{user?.name}</p>
            <p className="text-xs leading-tight text-slate-500">{user?.roleName}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          aria-label="Log out"
          title="Log out"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-rose-600"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}