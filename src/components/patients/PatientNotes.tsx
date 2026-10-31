import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, FileText, Lock, LockOpen, Pencil, Plus, Printer, Search, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/audit";
import Modal from "../billing/Modal";
import { HOSPITAL, formatDate, todayISO } from "../../types/billing";
import { ageLabel, allergyList, type Patient } from "../../types/patients";
import {
  NOTE_CATEGORIES,
  canPrescribe,
  fmtDateTime,
  fromLocalInput,
  isNoteLocked,
  lockSummary,
  toLocalInput,
  uid,
  type ClinicalNote,
  type NoteCategory,
  type PatientRecords,
} from "../../types/records";
import { Field, WhenField, inputClass } from "./ui";

const categoryStyle: Record<NoteCategory, string> = {
  "Progress note": "bg-blue-50 text-blue-700",
  Consultation: "bg-violet-50 text-violet-700",
  Procedure: "bg-teal-50 text-teal-700",
  "Nursing note": "bg-emerald-50 text-emerald-700",
  Handover: "bg-amber-50 text-amber-700",
  Other: "bg-slate-100 text-slate-600",
};

interface Props {
  patient: Patient;
  rec: PatientRecords;
  commit: (r: PatientRecords) => void;
  me: string;
  myRole: string;
  canAdd: boolean;
  say: (m: string) => void;
}

// ---------- Export helpers ----------
const sortOldestFirst = (a: ClinicalNote, b: ClinicalNote) => a.at - b.at;

function patientHeader(patient: Patient) {
  const allergies = allergyList(patient);
  return [
    `Patient: ${patient.name} (${patient.id})`,
    `Age / sex: ${ageLabel(patient.dob)} · ${patient.gender}    Date of birth: ${formatDate(patient.dob)}`,
    `Blood group / genotype: ${patient.bloodGroup} · ${patient.genotype}`,
    `Allergies: ${allergies.length ? allergies.join(", ") : "none recorded"}`,
  ];
}

function notesToText(patient: Patient, notes: ClinicalNote[], all: ClinicalNote[], by: string): string {
  const lines: string[] = [
    HOSPITAL.name.toUpperCase(),
    [HOSPITAL.address, HOSPITAL.phone, HOSPITAL.email].filter(Boolean).join(" · "),
    "",
    "CLINICAL NOTES",
    ...patientHeader(patient),
    `Printed ${fmtDateTime(Date.now())} by ${by}. ${notes.length} note${notes.length === 1 ? "" : "s"}.`,
    "=".repeat(64),
  ];
  [...notes].sort(sortOldestFirst).forEach((n) => {
    lines.push("", `[${fmtDateTime(n.at)}] ${n.category}`, `Author: ${n.author}${n.authorRole ? ` (${n.authorRole})` : ""}  |  ${isNoteLocked(n) ? "LOCKED" : "OPEN (not yet signed off)"}`);
    if (n.recordedAt - n.at > 15 * 60_000) lines.push(`Written up: ${fmtDateTime(n.recordedAt)}`);
    if (n.revisions?.length) lines.push(`Edited ${n.revisions.length} time${n.revisions.length === 1 ? "" : "s"} before locking; earlier versions are kept in the record.`);
    lines.push("", n.text);
    all
      .filter((a) => a.addendumTo === n.id)
      .sort((a, b) => a.recordedAt - b.recordedAt)
      .forEach((a) => lines.push("", `  Addendum ${fmtDateTime(a.recordedAt)} · ${a.author}${a.authorRole ? ` (${a.authorRole})` : ""}`, `  ${a.text.replace(/\n/g, "\n  ")}`));
    lines.push("", "-".repeat(64));
  });
  lines.push("", "Confidential patient information. Handle in line with your hospital's records policy.");
  return lines.join("\n");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// While printing: hide the app, show only the notes sheet.
const printCss = `
@media print {
  body > *:not(.notes-portal) { display: none !important; }
  .notes-portal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
  .notes-portal .no-print { display: none !important; }
  .notes-portal .notes-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .notes-portal .note-block { break-inside: avoid; }
  @page { size: A4; margin: 14mm; }
}
`;

function NotesPrint({ patient, notes, all, by, onClose, onShown }: { patient: Patient; notes: ClinicalNote[]; all: ClinicalNote[]; by: string; onClose: () => void; onShown: () => void }) {
  useEffect(onShown, []); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="notes-portal fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 p-4 sm:p-8">
      <style>{printCss}</style>
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Printer size={16} /> Print / Save as PDF</button>
        <button onClick={onClose} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><X size={16} /> Close</button>
      </div>

      <div className="notes-sheet mx-auto max-w-3xl rounded-xl bg-white p-8 text-slate-800 shadow-xl sm:p-10">
        <div className="border-b border-slate-300 pb-4 text-center">
          <h1 className="text-2xl font-bold">{HOSPITAL.name}</h1>
          <p className="text-sm text-slate-600">{HOSPITAL.address}</p>
          <p className="text-sm text-slate-600">{[HOSPITAL.phone, HOSPITAL.email].filter(Boolean).join(" · ")}</p>
        </div>
        <h2 className="mt-4 text-lg font-semibold">Clinical Notes</h2>
        <div className="mt-2 space-y-0.5 text-sm text-slate-700">
          {patientHeader(patient).map((l) => (
            <p key={l}>{l}</p>
          ))}
          <p className="text-xs text-slate-500">Printed {fmtDateTime(Date.now())} by {by} · {notes.length} note{notes.length === 1 ? "" : "s"}</p>
        </div>

        <div className="mt-5 space-y-5">
          {[...notes].sort(sortOldestFirst).map((n) => (
            <div key={n.id} className="note-block border-t border-slate-200 pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <p className="font-semibold">{fmtDateTime(n.at)} · {n.category}</p>
                <p className="text-xs text-slate-500">{n.author}{n.authorRole && ` (${n.authorRole})`} · {isNoteLocked(n) ? "Locked" : "Open, not yet signed off"}</p>
              </div>
              {n.recordedAt - n.at > 15 * 60_000 && <p className="text-xs text-slate-400">Written up {fmtDateTime(n.recordedAt)}</p>}
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.text}</p>
              {all.filter((a) => a.addendumTo === n.id).sort((a, b) => a.recordedAt - b.recordedAt).map((a) => (
                <div key={a.id} className="mt-2 border-l-2 border-slate-300 pl-3 text-sm">
                  <p className="text-xs text-slate-500">Addendum · {fmtDateTime(a.recordedAt)} · {a.author}{a.authorRole && ` (${a.authorRole})`}</p>
                  <p className="whitespace-pre-wrap">{a.text}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">Confidential patient information.</p>
      </div>
    </div>,
    document.body
  );
}

// ---------- Single note view ----------
function NoteView({
  note,
  all,
  patient,
  me,
  canEditNote,
  canLockNote,
  isAdmin,
  onEdit,
  onLock,
  onUnlock,
  onDownload,
  onPrint,
  onClose,
}: {
  note: ClinicalNote;
  all: ClinicalNote[];
  patient: Patient;
  me: string;
  canEditNote: boolean;
  canLockNote: boolean;
  isAdmin: boolean;
  onEdit: (text: string, category: NoteCategory) => void;
  onLock: () => void;
  onUnlock: (reason: string) => void;
  onDownload: () => void;
  onPrint: () => void;
  onClose: () => void;
}) {
  const locked = isNoteLocked(note);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [category, setCategory] = useState<NoteCategory>(note.category);
  const [unlocking, setUnlocking] = useState(false);
  const [reason, setReason] = useState("");
  const addenda = all.filter((a) => a.addendumTo === note.id).sort((a, b) => a.recordedAt - b.recordedAt);

  const save = () => {
    if (!text.trim()) return;
    onEdit(text.trim(), category);
    setEditing(false);
  };

  return (
    <Modal title={`${note.category} · ${patient.name}`} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryStyle[note.category]}`}>{note.category}</span>
            <span className="font-medium text-slate-800">{fmtDateTime(note.at)}</span>
          </span>
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${locked ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>
            {locked ? <Lock size={12} /> : <LockOpen size={12} />} {locked ? "Locked" : "Open"}
          </span>
        </div>

        {editing ? (
          <div className="space-y-3">
            <Field label="Type">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as NoteCategory)}>
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <textarea className={inputClass} rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Note text" autoFocus />
            <p className="text-xs text-slate-500">The previous version is kept in the history below.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEditing(false); setText(note.text); setCategory(note.category); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={!text.trim()} className="rounded-lg bg-blue-600 px-4 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">Save changes</button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-slate-800">{note.text}</p>
        )}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-xs uppercase text-slate-400">Written by</dt><dd className="text-slate-800">{note.author}{note.authorRole && ` · ${note.authorRole}`}</dd></div>
          <div><dt className="text-xs uppercase text-slate-400">Written up</dt><dd className="text-slate-800">{fmtDateTime(note.recordedAt)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs uppercase text-slate-400">Status</dt><dd className="text-slate-700">{lockSummary(note)}</dd></div>
        </dl>

        {addenda.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-slate-500">Addenda ({addenda.length})</h3>
            {addenda.map((a) => (
              <div key={a.id} className="border-l-2 border-slate-200 pl-3">
                <p className="text-xs text-slate-500">{fmtDateTime(a.recordedAt)} · {a.author}{a.authorRole && ` (${a.authorRole})`}</p>
                <p className="whitespace-pre-wrap text-slate-700">{a.text}</p>
              </div>
            ))}
          </section>
        )}

        {(note.revisions?.length || note.lockLog?.length) ? (
          <details className="rounded-lg border border-slate-200 px-4 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-500">History ({(note.revisions?.length ?? 0) + (note.lockLog?.length ?? 0)})</summary>
            <ul className="mt-2 space-y-2 text-xs text-slate-600">
              {note.lockLog?.map((l, i) => (
                <li key={`l${i}`}>{fmtDateTime(l.at)} · {l.by} {l.action}{l.reason ? `: ${l.reason}` : ""} this note</li>
              ))}
              {note.revisions?.map((r, i) => (
                <li key={`r${i}`}>
                  <p>{fmtDateTime(r.at)} · {r.by} replaced this earlier version ({r.category}):</p>
                  <p className="mt-0.5 whitespace-pre-wrap rounded bg-slate-50 p-2 text-slate-500">{r.text}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {unlocking && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-3">
            <input className={`${inputClass} flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for unlocking (required)" aria-label="Reason for unlocking" autoFocus />
            <button onClick={() => setUnlocking(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600">Cancel</button>
            <button disabled={!reason.trim()} onClick={() => { onUnlock(reason.trim()); setUnlocking(false); setReason(""); }} className="rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50">Unlock note</button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex gap-2">
            <button onClick={onDownload} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"><Download size={14} /> Download</button>
            <button onClick={onPrint} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"><Printer size={14} /> Print / PDF</button>
          </div>
          <div className="flex gap-2">
            {canEditNote && !editing && <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50"><Pencil size={14} /> Edit</button>}
            {canLockNote && !locked && <button onClick={onLock} className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 font-medium text-white hover:bg-slate-900"><Lock size={14} /> Lock note</button>}
            {isAdmin && locked && !note.addendumTo && !unlocking && <button onClick={() => setUnlocking(true)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-amber-700 hover:bg-amber-50"><LockOpen size={14} /> Unlock</button>}
          </div>
        </div>
        {!locked && note.author !== me && !isAdmin && <p className="text-xs text-slate-400">Only {note.author} can edit this note while it is open.</p>}
      </div>
    </Modal>
  );
}

// ---------- Notes tab ----------
export default function PatientNotes({ patient, rec, commit, me, myRole, canAdd, say }: Props) {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const clinician = canPrescribe(user);

  const [category, setCategory] = useState<NoteCategory>("Progress note");
  const [text, setText] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(Date.now()));
  const [lockOnSave, setLockOnSave] = useState(false);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState<"all" | NoteCategory>("all");
  const [status, setStatus] = useState<"all" | "open" | "locked">("all");
  const [query, setQuery] = useState("");

  const [addendumFor, setAddendumFor] = useState<string | null>(null);
  const [addendumText, setAddendumText] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<ClinicalNote[] | null>(null);
  const [menu, setMenu] = useState(false);

  const mine = useMemo(() => rec.notes.filter((n) => n.patientId === patient.id), [rec.notes, patient.id]);
  const roots = mine.filter((n) => !n.addendumTo);
  const addendaOf = (id: string) => mine.filter((n) => n.addendumTo === id).sort((a, b) => a.recordedAt - b.recordedAt);

  const q = query.trim().toLowerCase();
  const shown = roots
    .filter((n) => filter === "all" || n.category === filter)
    .filter((n) => status === "all" || (status === "locked") === isNoteLocked(n))
    .filter((n) => !q || n.text.toLowerCase().includes(q) || n.author.toLowerCase().includes(q) || addendaOf(n.id).some((a) => a.text.toLowerCase().includes(q)))
    .sort((a, b) => b.at - a.at);

  const myOpen = roots.filter((n) => !isNoteLocked(n) && n.author === me);
  const viewing = viewId ? rec.notes.find((n) => n.id === viewId) ?? null : null;
  const viewingCategory = viewing?.category;
  useEffect(() => {
    if (viewId && viewingCategory) logAudit({ action: "View", module: "Clinical notes", summary: `Opened a ${viewingCategory.toLowerCase()} for ${patient.name} (${patient.id})` });
  }, [viewId, viewingCategory, patient.id, patient.name]);

  const flash = (m: string) => {
    say(m);
    window.setTimeout(() => say(""), 3000);
  };

  const replace = (id: string, fn: (n: ClinicalNote) => ClinicalNote) => commit({ ...rec, notes: rec.notes.map((n) => (n.id === id ? fn(n) : n)) });
  const lockEvent = (action: "locked" | "unlocked", reason?: string) => ({ at: Date.now(), by: me, action, reason });

  const canEditNote = (n: ClinicalNote) => canAdd && !isNoteLocked(n) && (n.author === me || isAdmin);
  const canLockNote = (n: ClinicalNote) => !isNoteLocked(n) && (n.author === me || clinician);

  const make = (t: string, cat: NoteCategory, at: number, addendumTo?: string, locked?: boolean): ClinicalNote => ({
    id: uid(), patientId: patient.id, at, recordedAt: Date.now(), category: cat, text: t.trim(), author: me, authorRole: myRole, addendumTo,
    ...(locked ? { locked: true, lockLog: [lockEvent("locked")] } : {}),
  });

  const add = (e: FormEvent) => {
    e.preventDefault();
    const at = fromLocalInput(when);
    if (!text.trim()) return setError("Write the note first.");
    if (!Number.isFinite(at)) return setError("Enter a valid date and time.");
    if (at > Date.now() + 60_000) return setError("The date and time can't be in the future.");
    // TODO: POST /patients/:id/notes via a services/ call
    commit({ ...rec, notes: [...rec.notes, make(text, category, at, undefined, lockOnSave)] });
    setText("");
    setWhen(toLocalInput(Date.now()));
    setError("");
    flash(lockOnSave ? "Note saved and locked." : "Note saved.");
  };

  const addAddendum = (parent: ClinicalNote) => {
    if (!addendumText.trim()) return;
    commit({ ...rec, notes: [...rec.notes, make(addendumText, parent.category, Date.now(), parent.id)] });
    setAddendumFor(null);
    setAddendumText("");
    flash("Addendum saved.");
  };

  const edit = (n: ClinicalNote, newText: string, newCategory: NoteCategory) => {
    if (newText === n.text && newCategory === n.category) return;
    // TODO: PUT /notes/:id via a services/ call (server keeps the revision history)
    replace(n.id, (x) => ({ ...x, text: newText, category: newCategory, revisions: [...(x.revisions ?? []), { at: Date.now(), by: me, text: x.text, category: x.category }] }));
    flash("Note updated. The earlier version is kept in its history.");
  };

  const lock = (n: ClinicalNote) => {
    // TODO: POST /notes/:id/lock via a services/ call
    replace(n.id, (x) => ({ ...x, locked: true, lockLog: [...(x.lockLog ?? []), lockEvent("locked")] }));
    flash("Note locked.");
  };

  const unlock = (n: ClinicalNote, reason: string) => {
    // TODO: POST /notes/:id/unlock via a services/ call (administrators only)
    replace(n.id, (x) => ({ ...x, locked: false, lockLog: [...(x.lockLog ?? []), lockEvent("unlocked", reason)] }));
    flash("Note unlocked.");
  };

  const lockAllMine = () => {
    if (myOpen.length === 0 || !window.confirm(`Lock ${myOpen.length} of your open note${myOpen.length === 1 ? "" : "s"}? Locked notes can only be corrected with an addendum.`)) return;
    const ids = new Set(myOpen.map((n) => n.id));
    commit({ ...rec, notes: rec.notes.map((n) => (ids.has(n.id) ? { ...n, locked: true, lockLog: [...(n.lockLog ?? []), lockEvent("locked")] } : n)) });
    flash(`${ids.size} note${ids.size === 1 ? "" : "s"} locked.`);
  };

  const fileName = (suffix = "") => `notes-${patient.id}${suffix}-${todayISO()}.txt`;
  const downloadList = (list: ClinicalNote[], suffix = "") => {
    if (list.length === 0) return;
    downloadText(fileName(suffix), notesToText(patient, list, mine, me));
    logAudit({ action: "Export", module: "Clinical notes", summary: `Downloaded ${list.length} note${list.length === 1 ? "" : "s"} of ${patient.name} (${patient.id}) as a text file` });
    flash(`Downloaded ${list.length} note${list.length === 1 ? "" : "s"}.`);
  };

  return (
    <div className="space-y-4">
      {canAdd ? (
        <form onSubmit={add} className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Plus size={15} /> New note</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as NoteCategory)}>
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <WhenField label="Date and time of event" value={when} onChange={setWhen} />
          </div>
          <textarea className={inputClass} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Findings, assessment, plan, or what was done" aria-label="Note text" />
          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={lockOnSave} onChange={(e) => setLockOnSave(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                Lock when saved
              </label>
              <p className="text-xs text-slate-500">Signed as <span className="font-medium text-slate-700">{me}</span>{myRole && ` (${myRole})`}. Open notes can be edited by their author for 24 hours, then lock automatically.</p>
            </div>
            <button type="submit" className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Save note</button>
          </div>
        </form>
      ) : (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">You can read the notes but don't have permission to add them.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Notes ({roots.length})</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="w-40 rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter notes by type" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value="all">All types</option>
            {NOTE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter notes by status" className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value="all">Open and locked</option>
            <option value="open">Open only</option>
            <option value="locked">Locked only</option>
          </select>
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)} disabled={shown.length === 0} aria-haspopup="menu" aria-expanded={menu} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <Download size={14} /> Download
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                <button role="menuitem" onClick={() => { downloadList(shown); setMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"><FileText size={14} /> Text file (.txt)</button>
                <button role="menuitem" onClick={() => { setPrinting(shown); setMenu(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"><Printer size={14} /> Print / Save as PDF</button>
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">{shown.length === roots.length ? `All ${shown.length} notes` : `${shown.length} of ${roots.length} notes (current filters)`}, with addenda.</p>
              </div>
            )}
          </div>
          {canAdd && myOpen.length > 0 && (
            <button onClick={lockAllMine} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><Lock size={14} /> Lock my open ({myOpen.length})</button>
          )}
        </div>
      </div>

      <ul className="space-y-3">
        {shown.map((note) => {
          const locked = isNoteLocked(note);
          return (
            <li key={note.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${categoryStyle[note.category]}`}>{note.category}</span>
                  <span className="font-medium text-slate-700">{fmtDateTime(note.at)}</span>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${locked ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>
                    {locked ? <Lock size={11} /> : <LockOpen size={11} />} {locked ? "Locked" : "Open"}
                  </span>
                  {note.revisions?.length ? <span className="text-slate-400">edited</span> : null}
                </span>
                <span className="text-slate-500">{note.author}{note.authorRole && ` · ${note.authorRole}`}</span>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-800">{note.text}</p>
              {note.recordedAt - note.at > 15 * 60_000 && <p className="mt-1 text-xs text-slate-400">Written up {fmtDateTime(note.recordedAt)}</p>}

              {addendaOf(note.id).map((a) => (
                <div key={a.id} className="mt-3 border-l-2 border-slate-200 pl-3">
                  <p className="text-xs text-slate-500">Addendum · {fmtDateTime(a.recordedAt)} · {a.author}{a.authorRole && ` (${a.authorRole})`}</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{a.text}</p>
                </div>
              ))}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium">
                <button onClick={() => setViewId(note.id)} className="flex items-center gap-1 text-blue-600 hover:underline"><Eye size={13} /> View</button>
                {canEditNote(note) && <button onClick={() => setViewId(note.id)} className="flex items-center gap-1 text-slate-600 hover:underline"><Pencil size={13} /> Edit</button>}
                {canLockNote(note) && <button onClick={() => lock(note)} className="flex items-center gap-1 text-slate-600 hover:underline"><Lock size={13} /> Lock</button>}
                <button onClick={() => downloadList([note], `-${note.id.slice(0, 4)}`)} className="flex items-center gap-1 text-slate-600 hover:underline"><Download size={13} /> Download</button>
                {canAdd && addendumFor !== note.id && <button onClick={() => { setAddendumFor(note.id); setAddendumText(""); }} className="text-blue-600 hover:underline">Add addendum</button>}
              </div>

              {canAdd && addendumFor === note.id && (
                <div className="mt-3 space-y-2">
                  <textarea className={inputClass} rows={2} value={addendumText} onChange={(e) => setAddendumText(e.target.value)} placeholder="Correction or additional information" aria-label="Addendum text" autoFocus />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setAddendumFor(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button type="button" onClick={() => addAddendum(note)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save addendum</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">{roots.length === 0 ? "No notes yet." : "No notes match these filters."}</li>
        )}
      </ul>

      {viewing && (
        <NoteView
          note={viewing}
          all={mine}
          patient={patient}
          me={me}
          canEditNote={canEditNote(viewing)}
          canLockNote={canLockNote(viewing)}
          isAdmin={isAdmin}
          onEdit={(t, c) => edit(viewing, t, c)}
          onLock={() => lock(viewing)}
          onUnlock={(r) => unlock(viewing, r)}
          onDownload={() => downloadList([viewing], `-${viewing.id.slice(0, 4)}`)}
          onPrint={() => setPrinting([viewing])}
          onClose={() => setViewId(null)}
        />
      )}
      {printing && <NotesPrint onShown={() => logAudit({ action: "Export", module: "Clinical notes", summary: `Opened ${printing.length} note${printing.length === 1 ? "" : "s"} of ${patient.name} (${patient.id}) for printing` })} patient={patient} notes={printing} all={mine} by={me} onClose={() => setPrinting(null)} />}
    </div>
  );
}