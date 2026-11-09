import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Download, Plus, Printer } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { diffById, logAudit } from "../services/audit";
import { addDaysISO, todayISO } from "../types/billing";
import { loadRoles, loadUsers } from "../types/access";
import {
  SHIFT_TYPES,
  UNITS,
  clashes,
  fmtDay,
  fmtLongDay,
  isOnDutyNow,
  loadRoster,
  saveRoster,
  shiftOf,
  shiftTimes,
  shiftWindow,
  toIcs,
  uid,
  weekDays,
  weekStart,
  type RosterEntry,
  type ShiftId,
} from "../types/roster";
import ShiftForm, { type StaffMember } from "../components/roster/ShiftForm";
import RosterPrint from "../components/roster/RosterPrint";

type Tab = "today" | "week" | "mine";
const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "mine", label: "My shifts" },
];

const selectClass = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Chip({ entry, onClick, compact = false }: { entry: RosterEntry; onClick?: () => void; compact?: boolean }) {
  const s = shiftOf(entry.shift);
  const body = (
    <>
      <span className="font-medium">{entry.shift}</span>
      {entry.unit !== "—" && <span className="block truncate opacity-80">{entry.unit}</span>}
      {!compact && entry.note && <span className="block truncate text-[10px] opacity-70">{entry.note}</span>}
    </>
  );
  const cls = `block w-full rounded-md px-2 py-1 text-left text-xs ring-1 ${s.chip}`;
  return onClick ? (
    <button type="button" onClick={onClick} title={`${entry.shift}, ${shiftTimes(entry.shift)}${entry.note ? `. ${entry.note}` : ""}`} className={`${cls} hover:brightness-95`}>{body}</button>
  ) : (
    <div title={`${entry.shift}, ${shiftTimes(entry.shift)}`} className={cls}>{body}</div>
  );
}

export default function DutyRoster() {
  const { user, can } = useAuth();
  const [entries, setEntries] = useState<RosterEntry[]>(loadRoster);
  const [tab, setTab] = useState<Tab>("today");
  const [week, setWeek] = useState(weekStart(todayISO()));
  const [unit, setUnit] = useState("all");
  const [showEveryone, setShowEveryone] = useState(false);
  const [form, setForm] = useState<{ entry: RosterEntry | null; preset?: { staffId?: string; date?: string } } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState("");

  const me = user?.id ?? "";
  const myName = user?.name ?? "Unknown user";
  const canAssign = can("Roster", "create");
  const canEdit = can("Roster", "edit");
  const canDelete = can("Roster", "delete");

  // Every active user is staff. People added on the Users page appear here automatically.
  const staff = useMemo<StaffMember[]>(() => {
    const roles = loadRoles();
    return loadUsers()
      .filter((u) => u.active)
      .map((u) => ({ id: u.id, name: u.name, role: roles.find((r) => r.id === u.roleId)?.name ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const flash = (m: string) => {
    setNotice(m);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const commit = (next: RosterEntry[]) => {
    const d = diffById(entries, next, (a, b) => JSON.stringify(a) === JSON.stringify(b));
    const describe = (x: RosterEntry) => `${x.staffName}, ${fmtDay(x.date)}: ${x.shift}${x.unit !== "—" ? ` (${x.unit})` : ""}`;
    if (d.created.length === 1) logAudit({ action: "Create", module: "Duty roster", summary: `Rostered ${describe(d.created[0])}` });
    else if (d.created.length > 1) logAudit({ action: "Create", module: "Duty roster", summary: `Assigned ${d.created.length} shifts to ${new Set(d.created.map((x) => x.staffId)).size} staff`, detail: d.created.slice(0, 15).map(describe).join("\n") });
    d.updated.forEach((x) => logAudit({ action: "Update", module: "Duty roster", summary: `Changed shift: ${describe(x)}` }));
    if (d.deleted.length === 1) logAudit({ action: "Delete", module: "Duty roster", summary: `Removed shift ${describe(d.deleted[0])}` });
    else if (d.deleted.length > 1) logAudit({ action: "Delete", module: "Duty roster", summary: `Removed ${d.deleted.length} shifts` });
    setEntries(next);
    // TODO: POST/PUT/DELETE /roster via a services/ call
    saveRoster(next);
  };

  const save = (created: RosterEntry[], replaceId?: string) => {
    commit(replaceId ? entries.map((e) => (e.id === replaceId ? created[0] : e)) : [...entries, ...created]);
    setForm(null);
    flash(created.length === 1 ? "Shift saved." : `${created.length} shifts assigned.`);
  };

  const remove = (entry: RosterEntry) => {
    if (!window.confirm(`Remove ${entry.staffName}'s ${entry.shift} shift on ${fmtDay(entry.date)}?`)) return;
    commit(entries.filter((e) => e.id !== entry.id));
    setForm(null);
    flash("Shift removed.");
  };

  const copyPreviousWeek = () => {
    const from = addDaysISO(week, -7);
    const source = entries.filter((e) => e.date >= from && e.date < week);
    const add: RosterEntry[] = [];
    source.forEach((e) => {
      const date = addDaysISO(e.date, 7);
      if (clashes([...entries, ...add], e.staffId, date, e.shift).block.length) return;
      add.push({ ...e, id: uid(), date, createdBy: myName, createdAt: Date.now() });
    });
    if (add.length === 0) return flash(source.length === 0 ? "Last week has no shifts to copy." : "Everything from last week is already on this week.");
    if (!window.confirm(`Copy ${add.length} shift${add.length === 1 ? "" : "s"} from last week to this week?`)) return;
    commit([...entries, ...add]);
    flash(`${add.length} shifts copied.`);
  };

  const today = todayISO();
  const now = new Date();
  const inUnit = (e: RosterEntry) => unit === "all" || e.unit === unit;

  // ---------- Today ----------
  const onDuty = entries.filter((e) => isOnDutyNow(e, now) && inUnit(e)).sort((a, b) => a.unit.localeCompare(b.unit) || a.staffName.localeCompare(b.staffName));
  const todays = entries.filter((e) => e.date === today && inUnit(e));

  // ---------- Week ----------
  const days = weekDays(week);
  const weekEntries = entries.filter((e) => e.date >= week && e.date <= addDaysISO(week, 6) && inUnit(e));
  const rows = useMemo(() => {
    const withShifts = new Set(weekEntries.map((e) => e.staffId));
    return staff
      .filter((s) => (showEveryone && canAssign && unit === "all") || withShifts.has(s.id))
      .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name)));
  }, [staff, weekEntries, showEveryone, canAssign, unit, me]);
  const weekLabel = `${fmtDay(week)} to ${fmtDay(addDaysISO(week, 6))}`;

  // ---------- Mine ----------
  const mine = entries.filter((e) => e.staffId === me).sort((a, b) => `${a.date}${shiftOf(a.shift).start}`.localeCompare(`${b.date}${shiftOf(b.shift).start}`));
  const upcoming = mine.filter((e) => e.date >= today && e.date <= addDaysISO(today, 30));
  const recent = mine.filter((e) => e.date < today && e.date >= addDaysISO(today, -7)).reverse();
  const nextShift = mine.find((e) => e.shift !== "Leave" && shiftWindow(e).end > now);
  const thisWeekCount = mine.filter((e) => e.date >= weekStart(today) && e.date <= addDaysISO(weekStart(today), 6) && e.shift !== "Leave").length;

  const downloadCalendar = () => {
    const list = mine.filter((e) => e.date >= today);
    if (list.length === 0) return flash("You have no upcoming shifts to export.");
    const blob = new Blob([toIcs(list, `${myName}: duty roster`)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-duty-roster-${today}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    logAudit({ action: "Export", module: "Duty roster", summary: `Downloaded own roster as a calendar file (${list.length} shifts)` });
  };

  const openPrint = () => {
    logAudit({ action: "Export", module: "Duty roster", summary: `Opened roster for ${weekLabel} for printing` });
    setPrinting(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "mine" && (
            <select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Filter by unit" className={selectClass}>
              <option value="all">All units</option>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          )}
          {canAssign && (
            <button onClick={() => setForm({ entry: null })} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} /> Assign shifts</button>
          )}
        </div>
      </div>

      {notice && <p role="status" className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{notice}</p>}

      {tab === "today" && (
        <div className="space-y-5">
          <p className="text-sm text-slate-500">{fmtLongDay(today)}</p>

          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="flex items-center justify-between border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">
              On duty now <span className="text-sm font-normal text-slate-500">{onDuty.length} {onDuty.length === 1 ? "person" : "people"}</span>
            </h2>
            <ul className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
              {onDuty.map((e) => (
                <li key={e.id} className={`flex items-center justify-between gap-3 bg-white px-5 py-3 ${e.staffId === me ? "bg-blue-50/60" : ""}`}>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.staffName}{e.staffId === me && <span className="ml-2 text-xs font-normal text-blue-600">(you)</span>}</p>
                    <p className="text-xs text-slate-500">{e.staffRole} · {e.unit}</p>
                  </div>
                  <span className="text-xs text-slate-500">until {shiftWindow(e).end.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
              {onDuty.length === 0 && <li className="col-span-full bg-white px-5 py-8 text-center text-sm text-slate-400">Nobody is rostered on duty right now.</li>}
            </ul>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {SHIFT_TYPES.map((s) => {
              const list = todays.filter((e) => e.shift === s.id).sort((a, b) => a.unit.localeCompare(b.unit));
              return (
                <section key={s.id} className="rounded-xl border border-slate-200 bg-white">
                  <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
                    {s.id} <span className="ml-1 font-normal text-slate-400">{shiftTimes(s.id)}</span>
                  </h3>
                  <ul className="divide-y divide-slate-100">
                    {list.map((e) => (
                      <li key={e.id} className="px-4 py-2 text-sm">
                        <p className="font-medium text-slate-800">{e.staffName}{e.staffId === me && <span className="ml-1 text-xs font-normal text-blue-600">(you)</span>}</p>
                        <p className="text-xs text-slate-500">{e.staffRole}{e.unit !== "—" && ` · ${e.unit}`}</p>
                      </li>
                    ))}
                    {list.length === 0 && <li className="px-4 py-4 text-center text-xs text-slate-400">Nobody</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {tab === "week" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeek(addDaysISO(week, -7))} aria-label="Previous week" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button>
              <button onClick={() => setWeek(weekStart(today))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">This week</button>
              <button onClick={() => setWeek(addDaysISO(week, 7))} aria-label="Next week" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><ChevronRight size={16} /></button>
              <span className="ml-2 text-sm font-medium text-slate-700">{weekLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canAssign && unit === "all" && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={showEveryone} onChange={(e) => setShowEveryone(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Show everyone
                </label>
              )}
              {canAssign && <button onClick={copyPreviousWeek} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Copy size={15} /> Copy last week</button>}
              <button onClick={openPrint} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Printer size={15} /> Print</button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-44 px-4 py-3">Staff</th>
                  {days.map((d) => (
                    <th key={d} className={`px-2 py-3 ${d === today ? "text-blue-600" : ""}`}>{fmtDay(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr key={s.id} className={s.id === me ? "bg-blue-50/40" : ""}>
                    <td className="px-4 py-2 align-top">
                      <p className="font-medium text-slate-800">{s.name}{s.id === me && <span className="ml-1 text-xs font-normal text-blue-600">(you)</span>}</p>
                      <p className="text-xs text-slate-500">{s.role}</p>
                    </td>
                    {days.map((d) => {
                      const cell = weekEntries.filter((e) => e.staffId === s.id && e.date === d);
                      return (
                        <td key={d} className={`space-y-1 px-2 py-2 align-top ${d === today ? "bg-blue-50/30" : ""}`}>
                          {cell.map((e) => (
                            <Chip key={e.id} entry={e} onClick={canEdit || canDelete ? () => setForm({ entry: e }) : undefined} />
                          ))}
                          {cell.length === 0 && canAssign && (
                            <button onClick={() => setForm({ entry: null, preset: { staffId: s.id, date: d } })} aria-label={`Assign shift to ${s.name} on ${fmtDay(d)}`} className="flex h-7 w-full items-center justify-center rounded-md text-slate-300 hover:bg-slate-50 hover:text-blue-600"><Plus size={14} /></button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">No shifts rostered for this week.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="flex flex-wrap gap-3 text-xs text-slate-500">
            {SHIFT_TYPES.map((s) => (
              <span key={s.id} className={`rounded px-2 py-0.5 ring-1 ${s.chip}`}>{s.id}: {shiftTimes(s.id)}</span>
            ))}
          </p>
        </div>
      )}

      {tab === "mine" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Next shift</p>
              {nextShift ? (
                <>
                  <p className="mt-1 text-lg font-semibold text-slate-800">{nextShift.date === today ? "Today" : fmtDay(nextShift.date)}: {nextShift.shift}</p>
                  <p className="text-xs text-slate-500">{shiftTimes(nextShift.shift)} · {nextShift.unit}</p>
                </>
              ) : (
                <p className="mt-1 text-lg font-semibold text-slate-800">None rostered</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Shifts this week</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">{thisWeekCount}</p>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <p className="text-sm text-slate-500">Put it on your phone</p>
                <p className="text-xs text-slate-400">Download your shifts for Google or Apple Calendar.</p>
              </div>
              <button onClick={downloadCalendar} className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"><CalendarPlus size={15} /> .ics</button>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">Coming up (next 30 days)</h2>
            <ul className="divide-y divide-slate-100">
              {upcoming.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.date === today ? "Today" : fmtLongDay(e.date)}</p>
                    <p className="text-xs text-slate-500">{shiftTimes(e.shift)}{e.unit !== "—" && ` · ${e.unit}`}{e.note && ` · ${e.note}`}</p>
                  </div>
                  <span className="flex items-center gap-2">
                    {isOnDutyNow(e, now) && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">On duty now</span>}
                    <span className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${shiftOf(e.shift).chip}`}>{e.shift}</span>
                  </span>
                </li>
              ))}
              {upcoming.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">You have no shifts rostered in the next 30 days.</li>}
            </ul>
          </section>

          {recent.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-white px-5 py-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-600">Last 7 days ({recent.length})</summary>
              <ul className="mt-2 divide-y divide-slate-100 text-sm text-slate-600">
                {recent.map((e) => (
                  <li key={e.id} className="flex justify-between py-2"><span>{fmtLongDay(e.date)}</span><span>{e.shift}{e.unit !== "—" && ` · ${e.unit}`}</span></li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {form && (
        <ShiftForm staff={staff} entries={entries} editing={form.entry} preset={form.preset} canDelete={canDelete} onSave={save} onDelete={remove} onClose={() => setForm(null)} />
      )}
      {printing && <RosterPrint start={week} staff={rows} entries={weekEntries} unitLabel={unit === "all" ? "All units" : unit} by={myName} onClose={() => setPrinting(false)} />}
    </div>
  );
}

// Keep ShiftId in the module graph for consumers that import the page's types.
export type { ShiftId };