import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import Modal from "../billing/Modal";
import { useAuth } from "../../context/AuthContext";
import { addDaysISO, todayISO } from "../../types/billing";
import { SHIFT_TYPES, UNITS, clashes, fmtDay, shiftTimes, uid, type RosterEntry, type ShiftId } from "../../types/roster";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayIndex = (iso: string) => (new Date(`${iso}T00:00:00`).getDay() + 6) % 7; // Monday = 0

export default function ShiftForm({
  staff,
  entries,
  editing,
  preset,
  canDelete,
  onSave,
  onDelete,
  onClose,
}: {
  staff: StaffMember[];
  entries: RosterEntry[];
  editing: RosterEntry | null;
  preset?: { staffId?: string; date?: string };
  canDelete: boolean;
  onSave: (created: RosterEntry[], replaceId?: string) => void;
  onDelete: (entry: RosterEntry) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const me = user?.name ?? "Unknown user";

  const [picked, setPicked] = useState<Set<string>>(new Set(preset?.staffId ? [preset.staffId] : []));
  const [start, setStart] = useState(editing?.date ?? preset?.date ?? todayISO());
  const [end, setEnd] = useState(editing?.date ?? preset?.date ?? todayISO());
  const [days, setDays] = useState<number[]>(preset?.date ? [dayIndex(preset.date)] : [0, 1, 2, 3, 4]);
  const [shift, setShift] = useState<ShiftId>(editing?.shift ?? "Morning");
  const [unit, setUnit] = useState(editing?.unit ?? UNITS[0]);
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState("");

  const isLeave = shift === "Leave";
  const rangeDays = useMemo(() => {
    const list: string[] = [];
    if (!start || !end || end < start) return list;
    for (let d = start, n = 0; d <= end && n < 63; d = addDaysISO(d, 1), n++) list.push(d);
    return list;
  }, [start, end]);

  const plan = useMemo(() => {
    const dates = editing ? [start] : rangeDays.filter((d) => days.includes(dayIndex(d)));
    const who = editing ? [editing.staffId] : [...picked];
    let create = 0;
    let skipped = 0;
    let warnings = 0;
    const items: { staffId: string; date: string }[] = [];
    who.forEach((id) =>
      dates.forEach((date) => {
        const c = clashes(entries, id, date, shift, editing?.id);
        if (c.block.length) skipped++;
        else {
          create++;
          items.push({ staffId: id, date });
          if (c.warn.length) warnings++;
        }
      })
    );
    return { create, skipped, warnings, items, warnTexts: who.flatMap((id) => dates.map((date) => ({ id, date, w: clashes(entries, id, date, shift, editing?.id).warn }))).filter((x) => x.w.length) };
  }, [editing, start, rangeDays, days, picked, entries, shift]);

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? editing?.staffName ?? "Staff";

  const toggleStaff = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing && picked.size === 0) return setError("Choose at least one staff member.");
    if (!editing && (!start || !end || end < start)) return setError("Choose a valid date range.");
    if (!editing && (new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000 >= 62) return setError("Roster at most 9 weeks at a time.");
    if (!editing && days.length === 0) return setError("Choose at least one day of the week.");
    if (editing && !start) return setError("Choose a date.");
    if (plan.create === 0) return setError("Nothing to add: everyone chosen already has this shift on those days.");
    if (plan.warnings > 0) {
      const first = plan.warnTexts[0];
      if (!window.confirm(`${plan.warnings} shift${plan.warnings === 1 ? "" : "s"} may clash, for example ${nameOf(first.id)} on ${fmtDay(first.date)} ${first.w[0]}. Continue anyway?`)) return;
    }
    const finalUnit = isLeave ? "—" : unit;
    const made: RosterEntry[] = plan.items.map(({ staffId, date }) => {
      const person = staff.find((s) => s.id === staffId);
      return {
        id: editing && editing.staffId === staffId ? editing.id : uid(),
        date: editing ? start : date,
        staffId,
        staffName: person?.name ?? editing?.staffName ?? "Staff",
        staffRole: person?.role ?? editing?.staffRole ?? "",
        shift,
        unit: finalUnit,
        note: note.trim(),
        createdBy: editing?.createdBy ?? me,
        createdAt: editing?.createdAt ?? Date.now(),
      };
    });
    onSave(made, editing?.id);
  };

  // When editing a single shift the date can be changed too; re-check clashes for the new date.
  const editClash = editing ? clashes(entries, editing.staffId, start, shift, editing.id) : null;

  return (
    <Modal title={editing ? `Edit shift: ${editing.staffName}` : "Assign Shifts"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {!editing && (
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-slate-600">Staff ({picked.size} chosen)</span>
              <button type="button" onClick={() => setPicked(picked.size === staff.length ? new Set() : new Set(staff.map((s) => s.id)))} className="text-xs font-medium text-blue-600 hover:underline">
                {picked.size === staff.length ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggleStaff(s.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-slate-800">{s.name}</span>
                  <span className="text-xs text-slate-400">{s.role}</span>
                </label>
              ))}
              {staff.length === 0 && <p className="px-2 py-1 text-sm text-slate-400">No active staff. Add users first.</p>}
            </div>
          </div>
        )}

        {editing ? (
          <Field label="Date"><input type="date" className={inputClass} value={start} onChange={(e) => { setStart(e.target.value); setEnd(e.target.value); }} /></Field>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From"><input type="date" className={inputClass} value={start} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} /></Field>
              <Field label="To"><input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
            </div>
            <div>
              <span className="mb-1 block text-sm text-slate-600">On these days</span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d, i) => (
                  <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => setDays((x) => (x.includes(i) ? x.filter((n) => n !== i) : [...x, i].sort()))} className={`rounded-full px-3 py-1 text-xs font-medium ${days.includes(i) ? "bg-blue-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shift">
            <select className={inputClass} value={shift} onChange={(e) => setShift(e.target.value as ShiftId)}>
              {SHIFT_TYPES.map((s) => (
                <option key={s.id} value={s.id}>{s.id} ({shiftTimes(s.id)})</option>
              ))}
            </select>
          </Field>
          <Field label="Unit / ward">
            <select className={inputClass} value={isLeave ? "—" : unit} onChange={(e) => setUnit(e.target.value)} disabled={isLeave}>
              {isLeave ? <option>—</option> : UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Note (optional)" className="sm:col-span-2"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Covering for Dr. Obi, or handover instructions" /></Field>
        </div>

        {editClash && (editClash.block.length > 0 || editClash.warn.length > 0) && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{editing?.staffName} {[...editClash.block, ...editClash.warn].join(", ")}.</p>
        )}
        {!editing && (
          <p className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Will add <span className="font-semibold text-slate-800">{plan.create}</span> shift{plan.create === 1 ? "" : "s"}
            {plan.skipped > 0 && `, skipping ${plan.skipped} that already exist`}
            {plan.warnings > 0 && `. ${plan.warnings} may clash with rest rules or other shifts`}.
          </p>
        )}

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <div>
            {editing && canDelete && (
              <button type="button" onClick={() => onDelete(editing)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"><Trash2 size={14} /> Remove shift</button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">{editing ? "Save" : "Assign"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}