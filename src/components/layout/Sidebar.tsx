import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  FlaskConical,
  Pill,
  HeartPulse,
  BedDouble,
  Receipt,
  Settings,
  ShieldCheck,
  Tag,
  Landmark,
  FileText,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { Module } from "../../types/access";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Shown only if the user can view this module. */
  module?: Module;
  /** Shown only to administrators. */
  adminOnly?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Patients", path: "/patients", icon: Users, module: "Patients" },
  { label: "Appointments", path: "/appointments", icon: CalendarDays, module: "Appointments" },
  { label: "Doctors", path: "/doctors", icon: Stethoscope, module: "Doctors" },
  { label: "Laboratory", path: "/laboratory", icon: FlaskConical, module: "Laboratory" },
  { label: "Pharmacy", path: "/pharmacy", icon: Pill, module: "Pharmacy" },
  { label: "Nursing", path: "/nursing", icon: HeartPulse, module: "Nursing" },
  { label: "Admissions", path: "/admissions", icon: BedDouble, module: "Admissions" },
  { label: "Billing", path: "/billing", icon: Receipt, module: "Billing" },
  { label: "Accounts", path: "/accounts", icon: Landmark, module: "Accounts" },
  { label: "Price List", path: "/price-list", icon: Tag, module: "Billing" },
  { label: "Reports", path: "/reports", icon: FileText, module: "Reports" },
  { label: "Admin", path: "/admin", icon: ShieldCheck, adminOnly: true },
  { label: "Settings", path: "/settings", icon: Settings, module: "Settings" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user, can } = useAuth();

  const visible = navItems.filter((item) => {
    if (item.adminOnly) return !!user?.isAdmin;
    if (item.module) return can(item.module);
    return true;
  });

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-slate-900/50 transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              H
            </div>
            <span className="text-base font-semibold text-slate-800">Hospital MS</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visible.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 text-xs text-slate-400">v1.0.0</div>
      </aside>
    </>
  );
}