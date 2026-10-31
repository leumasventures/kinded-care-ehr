import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Info,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Tag,
  UserPlus,
  Users as UsersIcon,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ACTIONS, MODULES, loadRoles, loadUsers, type Action } from "../types/access";

const ADMIN_ROLE_ID = "r-admin";
const STALE_DAYS = 30;

// Sample activity. Replace with the audit log from the backend (GET /audit-logs).
const activity: { id: number; icon: LucideIcon; tone: string; text: string; time: string }[] = [
  { id: 1, icon: ShieldCheck, tone: "bg-blue-50 text-blue-600", text: "Admin User created role “Cashier”", time: "Today, 08:20" },
  { id: 2, icon: UserX, tone: "bg-rose-50 text-rose-600", text: "Tobi Pharm was deactivated", time: "Yesterday, 16:45" },
  { id: 3, icon: UserPlus, tone: "bg-emerald-50 text-emerald-600", text: "Kelechi Cash was added as Cashier", time: "Yesterday, 11:10" },
  { id: 4, icon: KeyRound, tone: "bg-amber-50 text-amber-600", text: "Permissions updated for role “Nurse”", time: "Oct 25, 09:32" },
];

type Level = "Full" | "Edit" | "View" | "None";

const levelStyle: Record<Level, string> = {
  Full: "bg-emerald-50 text-emerald-700",
  Edit: "bg-blue-50 text-blue-700",
  View: "bg-slate-100 text-slate-600",
  None: "text-slate-300",
};

const levelOf = (p: Record<Action, boolean>): Level => {
  if (ACTIONS.every((a) => p[a])) return "Full";
  if (p.create || p.edit || p.delete) return "Edit";
  if (p.view) return "View";
  return "None";
};

const daysSince = (stamp: string) => {
  const d = new Date(`${stamp.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null; // e.g. "Never"
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
};

const quickLinks: { to: string; label: string; hint: string; icon: LucideIcon }[] = [
  { to: "/admin/users", label: "Users", hint: "Add, edit, reset passwords, deactivate", icon: UsersIcon },
  { to: "/admin/roles", label: "Roles & permissions", hint: "Create roles and set access", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit log", hint: "Who did what, and when", icon: ScrollText },
  { to: "/price-list", label: "Price list", hint: "Services, drugs and care charges", icon: Tag },
  { to: "/reports", label: "Reports", hint: "Financial and clinical summaries", icon: FileText },
];

export default function Admin() {
  const { user: me } = useAuth();
  const allUsers = loadUsers();
  const allRoles = loadRoles();

  const total = allUsers.length;
  const active = allUsers.filter((u) => u.active);
  const inactive = total - active.length;
  const activeAdmins = active.filter((u) => u.roleId === ADMIN_ROLE_ID).length;

  const usersPerRole = allRoles.map((r) => ({
    role: r,
    count: allUsers.filter((u) => u.roleId === r.id).length,
  }));
  const maxCount = Math.max(1, ...usersPerRole.map((r) => r.count));

  // ---- Needs attention ----
  const attention: { tone: "warn" | "info"; text: string }[] = [];
  if (activeAdmins <= 1)
    attention.push({ tone: "warn", text: "Only one active administrator. Add another so you can't be locked out." });
  if (inactive > 0)
    attention.push({ tone: "info", text: `${inactive} deactivated account${inactive > 1 ? "s" : ""} — delete if no longer needed.` });

  const stale = allUsers.filter((u) => u.active && (daysSince(u.lastLogin) ?? 0) > STALE_DAYS);
  if (stale.length > 0)
    attention.push({ tone: "warn", text: `No login in ${STALE_DAYS}+ days: ${stale.map((u) => u.name).join(", ")}.` });

  const neverLoggedIn = allUsers.filter((u) => u.active && daysSince(u.lastLogin) === null);
  if (neverLoggedIn.length > 0)
    attention.push({ tone: "info", text: `Never logged in: ${neverLoggedIn.map((u) => u.name).join(", ")}.` });

  const emptyRoles = usersPerRole.filter((r) => r.count === 0).map((r) => r.role.name);
  if (emptyRoles.length > 0)
    attention.push({ tone: "info", text: `Roles with no users: ${emptyRoles.join(", ")}.` });

  const stats = [
    { label: "Total users", value: total, icon: UsersIcon, color: "bg-blue-50 text-blue-600" },
    { label: "Active", value: active.length, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
    { label: "Inactive", value: inactive, icon: UserX, color: "bg-rose-50 text-rose-600" },
    { label: "Roles", value: allRoles.length, icon: ShieldCheck, color: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Welcome back{me ? `, ${me.name}` : ""}</h2>
        <p className="text-sm text-slate-500">Manage who can sign in and what each role can do.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color}`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-semibold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">Needs attention</h2>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-700">
              <CheckCircle2 size={16} /> All clear. Nothing needs your attention.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {attention.map((a) => (
                <li key={a.text} className="flex items-start gap-3 px-5 py-3 text-sm text-slate-700">
                  {a.tone === "warn" ? (
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  ) : (
                    <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
                  )}
                  {a.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">Users per role</h2>
          <div className="space-y-4 p-5">
            {usersPerRole.map(({ role, count }) => (
              <div key={role.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{role.name}</span>
                  <span className="text-slate-500">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Access by role</h2>
          <Link to="/admin/roles" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
            Edit roles <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Role</th>
                {MODULES.map((m) => (
                  <th key={m} className="px-3 py-3 text-center">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allRoles.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">{r.name}</td>
                  {MODULES.map((m) => {
                    const perms = r.permissions[m];
                    const level = levelOf(perms);
                    const granted = ACTIONS.filter((a) => perms[a]).join(", ") || "no access";
                    return (
                      <td key={m} className="px-3 py-3 text-center">
                        <span title={`${r.name} — ${m}: ${granted}`} className={`rounded-full px-2 py-0.5 text-xs font-medium ${levelStyle[level]}`}>
                          {level === "None" ? "—" : level}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Full = view, create, edit and delete · Edit = can change records · View = read only. Hover a cell for details.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">Recent activity</h2>
          <ul className="divide-y divide-slate-100">
            {activity.map(({ id, icon: Icon, tone, text, time }) => (
              <li key={id} className="flex items-center gap-3 px-5 py-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon size={15} />
                </div>
                <span className="flex-1 text-sm text-slate-700">{text}</span>
                <span className="shrink-0 text-xs text-slate-400">{time}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            Sample entries. This will show the real audit log once the backend is connected.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">Quick links</h2>
          <div className="space-y-2 p-4">
            {quickLinks.map(({ to, label, hint, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon size={17} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500">{hint}</p>
                </div>
                <ArrowRight size={16} className="text-slate-400" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}