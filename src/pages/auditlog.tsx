import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Download, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AUDIT_ACTIONS, checkIntegrity, loadAudit, logAudit, type AuditAction, type AuditEntry } from "../services/audit";
import { todayISO } from "../types/billing";

const PAGE_SIZE = 25;

const actionStyle: Record<AuditAction, string> = {
  "Sign in": "bg-emerald-50 text-emerald-700",
  "Failed sign-in": "bg-rose-50 text-rose-700",
  "Sign out": "bg-slate-100 text-slate-600",
  View: "bg-slate-100 text-slate-600",
  Create: "bg-blue-50 text-blue-700",
  Update: "bg-amber-50 text-amber-700",
  Delete: "bg-rose-50 text-rose-700",
  Lock: "bg-slate-200 text-slate-700",
  Unlock: "bg-amber-50 text-amber-700",
  Void: "bg-rose-50 text-rose-700",
  Payment: "bg-teal-50 text-teal-700",
  Export: "bg-violet-50 text-violet-700",
  Security: "bg-rose-50 text-rose-700",
};

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });

const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Spreadsheet apps run text starting with = + - @ as a formula, so neutralise those cells.
const csvCell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

const inputClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function AuditLogInner() {
  const [entries, setEntries] = useState<AuditEntry[]>(loadAudit);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [who, setWho] = useState("all");
  const [module, setModule] = useState("all");
  const [action, setAction] = useState<"all" | AuditAction>("all");
  const [outcome, setOutcome] = useState<"all" | "success" | "failure">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<{ ok: boolean; message: string } | null>(null);

  const sorted = useMemo(() => [...entries].sort((a, b) => b.seq - a.seq), [entries]);
  const users = useMemo(() => Array.from(new Set(entries.map((e) => e.userName))).sort(), [entries]);
  const modules = useMemo(() => Array.from(new Set(entries.map((e) => e.module))).sort(), [entries]);

  const rows = sorted
    .filter((e) => !from || localDate(e.at) >= from)
    .filter((e) => !to || localDate(e.at) <= to)
    .filter((e) => who === "all" || e.userName === who)
    .filter((e) => module === "all" || e.module === module)
    .filter((e) => action === "all" || e.action === action)
    .filter((e) => outcome === "all" || e.outcome === outcome)
    .filter((e) => {
      const q = query.trim().toLowerCase();
      return !q || e.summary.toLowerCase().includes(q) || (e.detail ?? "").toLowerCase().includes(q) || e.userName.toLowerCase().includes(q);
    });

  const day = 86_400_000;
  const todays = entries.filter((e) => localDate(e.at) === todayISO());
  const stats = [
    { label: "Events today", value: todays.length },
    { label: "People active today", value: new Set(todays.filter((e) => e.userId !== "anonymous").map((e) => e.userId)).size },
    { label: "Failed sign-ins (24 h)", value: entries.filter((e) => e.action === "Failed sign-in" && Date.now() - e.at < day).length, warn: true },
    { label: "Deletes, voids and unlocks (7 days)", value: entries.filter((e) => ["Delete", "Void", "Unlock"].includes(e.action) && Date.now() - e.at < 7 * day).length, warn: true },
  ];

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filtered = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  const refresh = () => setEntries(loadAudit());

  const exportCsv = () => {
    logAudit({ action: "Export", module: "Audit Log", summary: `Exported ${rows.length} audit log entries to CSV` });
    const header = ["No.", "Time", "User", "Role", "Action", "Module", "Summary", "Detail", "Outcome", "Device"];
    const lines = rows.map((e) =>
      [String(e.seq), new Date(e.at).toISOString(), e.userName, e.role, e.action, e.module, e.summary, e.detail ?? "", e.outcome, e.device].map(csvCell).join(",")
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">A permanent record of who did what, and when. Entries can't be edited or deleted from here. <Link to="/admin" className="text-blue-600 hover:underline">Back to Admin</Link></p>
        <div className="flex gap-2">
          <button onClick={() => setIntegrity(checkIntegrity(entries))} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><ShieldCheck size={15} /> Check integrity</button>
          <button onClick={refresh} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><RefreshCw size={15} /> Refresh</button>
          <button onClick={exportCsv} disabled={rows.length === 0} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"><Download size={15} /> Export CSV</button>
        </div>
      </div>

      {integrity && (
        <p role="status" className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${integrity.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {integrity.ok ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />} {integrity.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.warn && s.value > 0 ? "text-rose-600" : "text-slate-800"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input value={query} onChange={(e) => filtered(setQuery)(e.target.value)} placeholder="Search activity" aria-label="Search activity" className={`${inputClass} w-56`} />
        <label className="flex items-center gap-2 text-sm text-slate-500">From <input type="date" value={from} max={to || undefined} onChange={(e) => filtered(setFrom)(e.target.value)} className={inputClass} /></label>
        <label className="flex items-center gap-2 text-sm text-slate-500">To <input type="date" value={to} min={from || undefined} onChange={(e) => filtered(setTo)(e.target.value)} className={inputClass} /></label>
        <select value={who} onChange={(e) => filtered(setWho)(e.target.value)} aria-label="Filter by user" className={inputClass}>
          <option value="all">All users</option>
          {users.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select value={module} onChange={(e) => filtered(setModule)(e.target.value)} aria-label="Filter by module" className={inputClass}>
          <option value="all">All modules</option>
          {modules.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select value={action} onChange={(e) => filtered(setAction)(e.target.value as typeof action)} aria-label="Filter by action" className={inputClass}>
          <option value="all">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select value={outcome} onChange={(e) => filtered(setOutcome)(e.target.value as typeof outcome)} aria-label="Filter by outcome" className={inputClass}>
          <option value="all">Any outcome</option>
          <option value="success">Succeeded</option>
          <option value="failure">Failed</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((e) => (
              <Fragment key={e.id}>
                <tr className={e.outcome === "failure" ? "bg-rose-50/40" : "hover:bg-slate-50"}>
                  <td className="px-3 py-2">
                    <button onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id} aria-label={`Details for entry ${e.seq}`} className="rounded p-1 text-slate-400 hover:text-slate-700">
                      {open === e.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{when(e.at)}</td>
                  <td className="px-4 py-2"><p className="font-medium text-slate-800">{e.userName}</p>{e.role && <p className="text-xs text-slate-500">{e.role}</p>}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionStyle[e.action]}`}>{e.action}</span></td>
                  <td className="px-4 py-2 text-slate-600">{e.module}</td>
                  <td className="px-4 py-2 text-slate-800">{e.summary}{e.outcome === "failure" && <span className="ml-2 text-xs font-medium text-rose-600">failed</span>}</td>
                </tr>
                {open === e.id && (
                  <tr className="bg-slate-50">
                    <td />
                    <td colSpan={5} className="px-4 py-3 text-xs text-slate-600">
                      <dl className="grid gap-2 sm:grid-cols-3">
                        <div><dt className="uppercase text-slate-400">Entry number</dt><dd>{e.seq}</dd></div>
                        <div><dt className="uppercase text-slate-400">Device</dt><dd>{e.device}</dd></div>
                        <div><dt className="uppercase text-slate-400">User ID</dt><dd>{e.userId}</dd></div>
                        <div className="sm:col-span-3"><dt className="uppercase text-slate-400">Detail</dt><dd className="whitespace-pre-wrap">{e.detail || "No further detail."}</dd></div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">{entries.length === 0 ? "No activity has been recorded yet." : "No entries match these filters."}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{rows.length.toLocaleString("en-NG")} of {entries.length.toLocaleString("en-NG")} entries</span>
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center gap-2">
            <span>Page {safePage} of {pages}</span>
            <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">Previous</button>
            <button disabled={safePage === pages} onClick={() => setPage(safePage + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400">Entries are kept in this browser for now. The backend must store them itself in a write-once table with its own timestamps and IP addresses, because anyone with access to this browser can change what is saved here.</p>
    </div>
  );
}

// Administrators only. The route is already protected; this stops the data being shown if the page is ever reused elsewhere.
export default function AuditLog() {
  const { user } = useAuth();
  if (!user?.isAdmin) {
    return <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Only administrators can open the audit log.</p>;
  }
  return <AuditLogInner />;
}