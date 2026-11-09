import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Circle, History, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/billing/Modal";
import { nowHHmm } from "../types/appointments";
import { todayISO } from "../types/billing";
import { logAudit } from "../services/audit";
import { usePersisted } from "../services/store";
import { medRound } from "../services/clinical";
import { loadRecords, saveRecords, type PatientRecords } from "../types/records";
import { WARD_NAMES, type WardName } from "../types/admissions";
import {
  VITALS_DUE_HOURS,
  admittedPatients,
  clock,
  seedNotes,
  seedTasks,
  seedVitals,
  timeAgo,
  uid,
  vitalFlags,
  type MedOrder,
  type MedStatus,
  type NursingNote,
  type NursingTask,
  type Vitals,
} from "../types/nursing";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const medStyle: Record<MedStatus, string> = {
  Due: "bg-blue-50 text-blue-700",
  Given: "bg-emerald-50 text-emerald-700",
  Held: "bg-amber-50 text-amber-700",
  Refused: "bg-rose-50 text-rose-700",
};

type Tab = "vitals" | "meds" | "tasks" | "notes";

function VitalsForm({
  patientLabel,
  nurse,
  onSave,
  onClose,
}: {
  patientLabel: string;
  nurse: string;
  onSave: (v: Omit<Vitals, "id" | "admissionId">) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({ temp: "", sys: "", dia: "", pulse: "", resp: "", spo2: "", note: "" });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, val: string) => setF((p) => ({ ...p, [k]: val }));

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const temp = num(f.temp), systolic = num(f.sys), diastolic = num(f.dia), pulse = num(f.pulse), resp = num(f.resp), spo2 = num(f.spo2);
    const all = [temp, systolic, diastolic, pulse, resp, spo2];
    if (all.every((x) => x === undefined)) return setError("Enter at least one reading.");
    if (all.some((x) => x !== undefined && Number.isNaN(x))) return setError("Readings must be numbers.");
    if ((systolic === undefined) !== (diastolic === undefined)) return setError("Enter both systolic and diastolic blood pressure.");
    const bad = (x: number | undefined, lo: number, hi: number) => x !== undefined && (x < lo || x > hi);
    if (bad(temp, 30, 45)) return setError("Temperature should be between 30 and 45 °C.");
    if (bad(pulse, 20, 250)) return setError("Pulse should be between 20 and 250.");
    if (bad(systolic, 50, 300) || bad(diastolic, 20, 200)) return setError("Check the blood pressure values.");
    if (systolic !== undefined && diastolic !== undefined && systolic <= diastolic) return setError("Systolic should be higher than diastolic.");
    if (bad(resp, 4, 60)) return setError("Respiratory rate should be between 4 and 60.");
    if (bad(spo2, 50, 100)) return setError("SpO₂ should be between 50 and 100 %.");
    // TODO: POST /vitals via a services/ call
    onSave({ recordedAt: Date.now(), recordedBy: nurse, temp, systolic, diastolic, pulse, resp, spo2, note: f.note.trim() || undefined });
  };

  const box = (label: string, key: keyof typeof f, step = "1") => (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input type="number" step={step} className={inputClass} value={f[key]} onChange={(e) => set(key, e.target.value)} />
    </label>
  );

  return (
    <Modal title={`Record vitals — ${patientLabel}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {box("Temperature (°C)", "temp", "0.1")}
          {box("Pulse (bpm)", "pulse")}
          {box("BP systolic (mmHg)", "sys")}
          {box("BP diastolic (mmHg)", "dia")}
          {box("Respiratory rate (/min)", "resp")}
          {box("SpO₂ (%)", "spo2")}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Note (optional)</span>
          <input className={inputClass} value={f.note} onChange={(e) => set("note", e.target.value)} />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
        </div>
      </form>
    </Modal>
  );
}

type ModalState =
  | { type: "vitals"; id: string }
  | { type: "history"; id: string }
  | null;

export default function Nursing() {
  const { user, can } = useAuth();
  const nurse = user?.name ?? "Nurse";

  const patients = useMemo(() => admittedPatients(), []);
  const patientOf = (id?: string) => patients.find((p) => p.id === id);
  const label = (id?: string) => {
    const p = patientOf(id);
    return p ? `${p.patient} (${p.bed})` : "General";
  };

  const [vitals, setVitals] = usePersisted<Vitals[]>("hms_nursing_vitals", () => seedVitals);
  // Doses come straight from the doctors' prescriptions, so nothing is typed in twice.
  const [rec, setRec] = useState<PatientRecords>(loadRecords);
  const meds = useMemo(() => medRound(patients, rec, todayISO()), [patients, rec]);
  const [tasks, setTasks] = usePersisted<NursingTask[]>("hms_nursing_tasks", () => seedTasks);
  const [notes, setNotes] = usePersisted<NursingNote[]>("hms_nursing_notes", () => seedNotes);
  const [tab, setTab] = useState<Tab>("vitals");
  const [ward, setWard] = useState<"all" | WardName>("all");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);

  const [taskText, setTaskText] = useState("");
  const [taskPatient, setTaskPatient] = useState("");
  const [noteText, setNoteText] = useState("");
  const [notePatient, setNotePatient] = useState(patients[0]?.id ?? "");

  const visible = patients.filter((p) => ward === "all" || p.ward === ward);
  const visibleIds = new Set(visible.map((p) => p.id));

  const latest = (id: string) => vitals.filter((v) => v.admissionId === id).sort((a, b) => b.recordedAt - a.recordedAt)[0];
  const isDue = (id: string) => {
    const l = latest(id);
    return !l || Date.now() - l.recordedAt > VITALS_DUE_HOURS * 3_600_000;
  };

  const now = nowHHmm();
  const isOverdue = (m: MedOrder) => m.status === "Due" && m.time < now;
  const visibleMeds = meds.filter((m) => visibleIds.has(m.admissionId));

  const stats = [
    { label: "Patients on ward", value: visible.length, tone: "text-slate-800" },
    { label: "Vitals due", value: visible.filter((p) => isDue(p.id)).length, tone: "text-amber-600" },
    { label: "Needing attention", value: visible.filter((p) => { const l = latest(p.id); return l && vitalFlags(l).length > 0; }).length, tone: "text-rose-600" },
    { label: "Meds overdue", value: visibleMeds.filter(isOverdue).length, tone: "text-rose-600" },
    { label: "Open tasks", value: tasks.filter((t) => !t.done && (!t.admissionId || visibleIds.has(t.admissionId))).length, tone: "text-blue-600" },
  ];

  const saveVitals = (admissionId: string, data: Omit<Vitals, "id" | "admissionId">) => {
    setVitals((prev) => [{ id: uid(), admissionId, ...data }, ...prev]);
    setModal(null);
  };

  const giveMed = (id: string, status: MedStatus) => {
    // TODO: POST /prescriptions/:id/administrations via a services/ call
    const m = meds.find((x) => x.id === id);
    const rx = rec.prescriptions.find((r) => r.id === m?.rxId);
    if (!m || !rx || status === "Due") return;
    const at = Date.now();
    const next: PatientRecords = {
      ...rec,
      administrations: [
        ...rec.administrations,
        { id: uid(), prescriptionId: rx.id, patientId: rx.patientId, at, recordedAt: at, outcome: status, drug: rx.drug, dose: rx.dose, route: rx.route, prescribedBy: rx.prescribedBy, administeredBy: nurse, administeredRole: user?.roleName ?? "Nurse", slot: m.time },
      ],
    };
    saveRecords(next);
    setRec(next);
    logAudit({ action: "Update", module: "Medication round", summary: `${status}: ${rx.drug} ${rx.dose} for ${m.admissionId} (${rx.patientId}), ${m.time} dose` });
  };

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!taskText.trim()) return;
    setTasks((prev) => [{ id: uid(), text: taskText.trim(), admissionId: taskPatient || undefined, done: false }, ...prev]);
    setTaskText("");
  };

  const addNote = (e: FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !notePatient) return;
    setNotes((prev) => [{ id: uid(), admissionId: notePatient, text: noteText.trim(), nurse, at: Date.now() }, ...prev]);
    setNoteText("");
  };

  const shownTasks = tasks.filter((t) => !t.admissionId || visibleIds.has(t.admissionId));
  const shownMeds = visibleMeds
    .filter((m) => !pendingOnly || m.status === "Due")
    .sort((a, b) => a.time.localeCompare(b.time));
  const shownNotes = notes.filter((n) => visibleIds.has(n.admissionId)).sort((a, b) => b.at - a.at);

  const target = modal ? patientOf(modal.id) : undefined;

  const cell = (val: string | number | undefined, bad: boolean) => (
    <span className={bad ? "font-semibold text-rose-600" : "text-slate-600"}>{val ?? "—"}</span>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ["vitals", "Vitals"],
              ["meds", "Medications"],
              ["tasks", "Tasks"],
              ["notes", "Notes"],
            ] as const
          ).map(([id, text]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {text}
            </button>
          ))}
        </div>
        <select value={ward} onChange={(e) => setWard(e.target.value as "all" | WardName)} aria-label="Filter by ward" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="all">All wards</option>
          {WARD_NAMES.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
      </div>

      {tab === "vitals" && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Last recorded</th>
                  <th className="px-5 py-3">Temp</th>
                  <th className="px-5 py-3">BP</th>
                  <th className="px-5 py-3">Pulse</th>
                  <th className="px-5 py-3">Resp</th>
                  <th className="px-5 py-3">SpO₂</th>
                  <th className="px-5 py-3">Flags</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((p) => {
                  const l = latest(p.id);
                  const flags = l ? vitalFlags(l) : [];
                  const due = isDue(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{p.patient}</p>
                        <p className="text-xs text-slate-500">{p.ward} · {p.bed}</p>
                      </td>
                      <td className="px-5 py-3">
                        {l ? (
                          <>
                            <p className="text-slate-600">{timeAgo(l.recordedAt)}</p>
                            <p className="text-xs text-slate-400">{l.recordedBy}</p>
                          </>
                        ) : (
                          <span className="text-slate-400">Never</span>
                        )}
                        {due && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">Due</span>}
                      </td>
                      <td className="px-5 py-3">{cell(l?.temp !== undefined ? `${l.temp}°C` : undefined, flags.some((f) => f.includes("emperature") || f === "Fever"))}</td>
                      <td className="px-5 py-3">{cell(l?.systolic !== undefined ? `${l.systolic}/${l.diastolic}` : undefined, flags.some((f) => f.includes("BP")))}</td>
                      <td className="px-5 py-3">{cell(l?.pulse, flags.some((f) => f.includes("pulse")))}</td>
                      <td className="px-5 py-3">{cell(l?.resp, flags.some((f) => f.includes("breathing")))}</td>
                      <td className="px-5 py-3">{cell(l?.spo2 !== undefined ? `${l.spo2}%` : undefined, flags.includes("Low SpO₂"))}</td>
                      <td className="px-5 py-3">
                        {flags.length > 0 ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-rose-700" title={flags.join(", ")}>
                            <AlertTriangle size={13} /> {flags.length > 1 ? `${flags[0]} +${flags.length - 1}` : flags[0]}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {can("Nursing", "create") && (
                            <button onClick={() => setModal({ type: "vitals", id: p.id })} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                              Record
                            </button>
                          )}
                          <button onClick={() => setModal({ type: "history", id: p.id })} title="History" aria-label={`Vitals history for ${p.patient}`} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
                            <History size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-slate-400">No admitted patients in this ward.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            Vitals are due after {VITALS_DUE_HOURS} hours. Flags are a guide to spot patients who may need review; use clinical judgement and your hospital's early-warning protocol. Patients come from the admissions list.
          </p>
        </>
      )}

      {tab === "meds" && (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              Show pending only
            </label>
            <p className="text-xs text-slate-500">Today's doses come from the doctors' prescriptions for admitted patients. To change a drug, the doctor edits it in the patient's chart.</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Medication</th>
                  <th className="px-5 py-3">Route</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shownMeds.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{m.time}</td>
                    <td className="px-5 py-3 text-slate-700">{label(m.admissionId)}</td>
                    <td className="px-5 py-3 text-slate-600">{m.drug} · {m.dose}</td>
                    <td className="px-5 py-3 text-slate-600">{m.route}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${medStyle[m.status]}`}>{m.status}</span>
                      {isOverdue(m) && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700">Overdue</span>}
                      {m.status !== "Due" && m.doneBy && <p className="mt-1 text-xs text-slate-400">{m.doneBy}{m.doneAt ? `, ${clock(m.doneAt)}` : ""}</p>}
                    </td>
                    <td className="px-5 py-3">
                      {can("Nursing", "edit") && m.status === "Due" && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => giveMed(m.id, "Given")} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Give</button>
                          <button onClick={() => giveMed(m.id, "Held")} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">Hold</button>
                          <button onClick={() => giveMed(m.id, "Refused")} className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">Refused</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {shownMeds.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">No medications to show.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "tasks" && (
        <div className="space-y-4">
          {can("Nursing", "create") && (
            <form onSubmit={addTask} className="flex flex-wrap gap-2">
              <input value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="Add a task for this shift" className={`${inputClass} min-w-60 flex-1`} />
              <select value={taskPatient} onChange={(e) => setTaskPatient(e.target.value)} aria-label="Patient (optional)" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">General</option>
                {visible.map((p) => (
                  <option key={p.id} value={p.id}>{p.patient} ({p.bed})</option>
                ))}
              </select>
              <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus size={16} /> Add
              </button>
            </form>
          )}
          <section className="rounded-xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {shownTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                  <button
                    disabled={!can("Nursing", "edit")}
                    onClick={() => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done, doneBy: x.done ? undefined : nurse } : x)))}
                    aria-label={t.done ? "Mark as not done" : "Mark as done"}
                    className="mt-0.5 shrink-0 disabled:cursor-default"
                  >
                    {t.done ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-slate-300 hover:text-slate-400" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm ${t.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{t.text}</p>
                    <p className="text-xs text-slate-400">{label(t.admissionId)}{t.done && t.doneBy ? ` · done by ${t.doneBy}` : ""}</p>
                  </div>
                  {can("Nursing", "delete") && (
                    <button onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))} aria-label="Delete task" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
              {shownTasks.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">No tasks.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          {can("Nursing", "create") && (
            <form onSubmit={addNote} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-2">
                <select value={notePatient} onChange={(e) => setNotePatient(e.target.value)} aria-label="Patient" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.patient} ({p.bed})</option>
                  ))}
                </select>
                <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write a nursing / handover note" className={`${inputClass} min-w-60 flex-1`} />
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add note</button>
              </div>
            </form>
          )}
          <section className="rounded-xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {shownNotes.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <p className="text-sm text-slate-700">{n.text}</p>
                  <p className="mt-1 text-xs text-slate-400">{label(n.admissionId)} · {n.nurse} · {timeAgo(n.at)}</p>
                </li>
              ))}
              {shownNotes.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">No notes yet.</li>}
            </ul>
          </section>
        </div>
      )}

      {modal?.type === "vitals" && target && (
        <VitalsForm patientLabel={`${target.patient} (${target.bed})`} nurse={nurse} onSave={(d) => saveVitals(target.id, d)} onClose={() => setModal(null)} />
      )}

      {modal?.type === "history" && target && (
        <Modal title={`Vitals history — ${target.patient}`} onClose={() => setModal(null)} wide>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Temp</th>
                  <th className="py-2 pr-4">BP</th>
                  <th className="py-2 pr-4">Pulse</th>
                  <th className="py-2 pr-4">Resp</th>
                  <th className="py-2 pr-4">SpO₂</th>
                  <th className="py-2">By / note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vitals
                  .filter((v) => v.admissionId === target.id)
                  .sort((a, b) => b.recordedAt - a.recordedAt)
                  .map((v) => (
                    <tr key={v.id}>
                      <td className="py-2 pr-4 text-slate-600">{timeAgo(v.recordedAt)}</td>
                      <td className="py-2 pr-4 text-slate-700">{v.temp !== undefined ? `${v.temp}°C` : "—"}</td>
                      <td className="py-2 pr-4 text-slate-700">{v.systolic !== undefined ? `${v.systolic}/${v.diastolic}` : "—"}</td>
                      <td className="py-2 pr-4 text-slate-700">{v.pulse ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-700">{v.resp ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-700">{v.spo2 !== undefined ? `${v.spo2}%` : "—"}</td>
                      <td className="py-2 text-xs text-slate-500">{v.recordedBy}{v.note ? ` — ${v.note}` : ""}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

    </div>
  );
}