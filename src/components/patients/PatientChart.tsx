import { useState, type FormEvent } from "react";
import { AlertTriangle, Ban, Pill, Plus, Syringe } from "lucide-react";
import PatientNotes from "./PatientNotes";
import { Field, WhenField, inputClass } from "./ui";
import { useAuth } from "../../context/AuthContext";
import { diffById, logAudit } from "../../services/audit";
import { allergyList, type Patient } from "../../types/patients";
import {
  FREQUENCIES,
  RX_ROUTES,
  allergyMatch,
  canPrescribe,
  fmtDateTime,
  fromLocalInput,
  loadRecords,
  saveRecords,
  toLocalInput,
  uid,
  type AdminOutcome,
  type PatientRecords,
  type Prescription,
} from "../../types/records";

const outcomeStyle: Record<AdminOutcome, string> = {
  Given: "bg-emerald-50 text-emerald-700",
  Held: "bg-amber-50 text-amber-700",
  Refused: "bg-rose-50 text-rose-700",
};

export default function PatientChart({ patient, tab }: { patient: Patient; tab: "notes" | "medications" }) {
  const { user, can } = useAuth();
  const [rec, setRec] = useState<PatientRecords>(loadRecords);
  const [message, setMessage] = useState("");

  // Records what changed (never the clinical text itself) so the audit log can show who documented what.
  const audit = (prev: PatientRecords, next: PatientRecords) => {
    const who = `${patient.name} (${patient.id})`;
    const notes = diffById(prev.notes, next.notes, (a, b) => JSON.stringify(a) === JSON.stringify(b));
    notes.created.forEach((n) =>
      logAudit({ action: "Create", module: "Clinical notes", summary: `${n.addendumTo ? "Added addendum to a note for" : `Added ${n.category.toLowerCase()} for`} ${who}`, detail: n.locked ? "Locked when saved" : undefined })
    );
    notes.updated.forEach((n) => {
      const old = prev.notes.find((x) => x.id === n.id);
      if (!old) return;
      if ((n.revisions?.length ?? 0) > (old.revisions?.length ?? 0)) logAudit({ action: "Update", module: "Clinical notes", summary: `Edited an open ${n.category.toLowerCase()} for ${who}`, detail: "Earlier version kept in the note's history" });
      const lastLock = n.lockLog?.[n.lockLog.length - 1];
      if ((n.lockLog?.length ?? 0) > (old.lockLog?.length ?? 0) && lastLock)
        logAudit({ action: lastLock.action === "locked" ? "Lock" : "Unlock", module: "Clinical notes", summary: `${lastLock.action === "locked" ? "Locked" : "Unlocked"} a ${n.category.toLowerCase()} for ${who}`, detail: lastLock.reason });
    });
    const rx = diffById(prev.prescriptions, next.prescriptions, (a, b) => a.status === b.status);
    rx.created.forEach((r) => logAudit({ action: "Create", module: "Medications", summary: `Prescribed ${r.drug} ${r.dose} (${r.route}) for ${who}`, detail: `${r.frequency}, ${r.duration}` }));
    rx.updated.forEach((r) => logAudit({ action: "Update", module: "Medications", summary: `Stopped ${r.drug} for ${who}`, detail: r.stopReason }));
    diffById(prev.administrations, next.administrations, () => true).created.forEach((a) =>
      logAudit({ action: "Create", module: "Medications", summary: `Recorded ${a.drug} ${a.outcome.toLowerCase()} for ${who}`, detail: `Prescribed by ${a.prescribedBy}${a.note ? `\nNote: ${a.note}` : ""}` })
    );
  };

  const commit = (next: PatientRecords) => {
    audit(rec, next);
    setRec(next);
    saveRecords(next);
  };

  const me = user?.name ?? "Unknown user";
  const myRole = user?.roleName ?? "";
  const allergies = allergyList(patient);

  return (
    <div className="space-y-4">
      {message && <p role="status" className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{message}</p>}
      {tab === "notes" ? (
        <PatientNotes patient={patient} rec={rec} commit={commit} me={me} myRole={myRole} canAdd={can("Patients", "create")} say={setMessage} />
      ) : (
        <Medications patient={patient} allergies={allergies} rec={rec} commit={commit} me={me} myRole={myRole} say={setMessage} />
      )}
    </div>
  );
}

type Shared = {
  patient: Patient;
  rec: PatientRecords;
  commit: (r: PatientRecords) => void;
  me: string;
  myRole: string;
  say: (m: string) => void;
};

const FREQ_HOURS: Record<string, number> = { "Every 8 hours": 8, "Every 12 hours": 12 };

function Medications({ patient, allergies, rec, commit, me, myRole, say }: Shared & { allergies: string[] }) {
  const { user, can } = useAuth();
  const prescriber = canPrescribe(user);
  const canGive = can("Nursing", "create") || prescriber;

  const [form, setForm] = useState({ drug: "", dose: "", route: "Oral", frequency: FREQUENCIES[1] as string, duration: "", instructions: "", toPharmacy: true });
  const [when, setWhen] = useState(() => toLocalInput(Date.now()));
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [giving, setGiving] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<AdminOutcome>("Given");
  const [giveWhen, setGiveWhen] = useState(() => toLocalInput(Date.now()));
  const [giveNote, setGiveNote] = useState("");
  const [giveError, setGiveError] = useState("");

  const [stopping, setStopping] = useState<string | null>(null);
  const [stopReason, setStopReason] = useState("");

  const flash = (m: string) => {
    say(m);
    window.setTimeout(() => say(""), 3000);
  };

  const mineRx = rec.prescriptions.filter((r) => r.patientId === patient.id);
  const active = mineRx.filter((r) => r.status === "Active").sort((a, b) => b.prescribedAt - a.prescribedAt);
  const stopped = mineRx.filter((r) => r.status === "Stopped").sort((a, b) => b.prescribedAt - a.prescribedAt);
  const log = rec.administrations.filter((a) => a.patientId === patient.id).sort((a, b) => b.at - a.at);
  const lastGiven = (rxId: string) => log.find((a) => a.prescriptionId === rxId && a.outcome === "Given");

  const allergyHit = allergyMatch(form.drug, allergies);

  const prescribe = (e: FormEvent) => {
    e.preventDefault();
    const at = fromLocalInput(when);
    if (!form.drug.trim()) return setFormError("Enter the drug name.");
    if (!form.dose.trim()) return setFormError("Enter the dose, e.g. 500 mg.");
    if (!Number.isFinite(at) || at > Date.now() + 60_000) return setFormError("Enter a valid date and time that is not in the future.");
    if (allergyHit && !window.confirm(`${patient.name} has a recorded allergy to "${allergyHit}". Prescribe ${form.drug.trim()} anyway?`)) return;
    const order: Prescription = {
      id: uid(),
      patientId: patient.id,
      drug: form.drug.trim(),
      dose: form.dose.trim(),
      route: form.route,
      frequency: form.frequency,
      duration: form.duration.trim() || "Until reviewed",
      instructions: form.instructions.trim(),
      prescribedAt: at,
      prescribedBy: me,
      status: "Active",
      ...(form.toPharmacy ? { toDispense: true } : {}),
    };
    // TODO: POST /patients/:id/prescriptions via a services/ call
    commit({ ...rec, prescriptions: [...rec.prescriptions, order] });
    setForm({ drug: "", dose: "", route: "Oral", frequency: FREQUENCIES[1], duration: "", instructions: "", toPharmacy: true });
    setWhen(toLocalInput(Date.now()));
    setFormError("");
    setShowForm(false);
    flash(`${order.drug} prescribed.`);
  };

  const startGiving = (r: Prescription) => {
    setGiving(r.id);
    setOutcome("Given");
    setGiveWhen(toLocalInput(Date.now()));
    setGiveNote("");
    setGiveError("");
  };

  const record = (r: Prescription) => {
    const at = fromLocalInput(giveWhen);
    if (!Number.isFinite(at) || at > Date.now() + 60_000) return setGiveError("Enter a valid date and time that is not in the future.");
    if (at < r.prescribedAt) return setGiveError("This can't be earlier than the time it was prescribed.");
    if (outcome !== "Given" && !giveNote.trim()) return setGiveError(`Say why it was ${outcome.toLowerCase()}.`);
    const prev = lastGiven(r.id);
    if (outcome === "Given" && prev && Math.abs(at - prev.at) < 30 * 60_000 && !window.confirm(`${r.drug} was already given at ${fmtDateTime(prev.at)} by ${prev.administeredBy}. Record another dose?`)) return;
    // TODO: POST /patients/:id/administrations via a services/ call
    commit({
      ...rec,
      administrations: [
        ...rec.administrations,
        {
          id: uid(), prescriptionId: r.id, patientId: patient.id, at, recordedAt: Date.now(), outcome,
          drug: r.drug, dose: r.dose, route: r.route, prescribedBy: r.prescribedBy,
          administeredBy: me, administeredRole: myRole, note: giveNote.trim() || undefined,
        },
      ],
    });
    setGiving(null);
    flash(`${r.drug} ${outcome.toLowerCase()} recorded.`);
  };

  const stop = (r: Prescription) => {
    if (!stopReason.trim()) return;
    // TODO: PATCH /prescriptions/:id via a services/ call
    commit({ ...rec, prescriptions: rec.prescriptions.map((x) => (x.id === r.id ? { ...x, status: "Stopped", stoppedAt: Date.now(), stoppedBy: me, stopReason: stopReason.trim() } : x)) });
    setStopping(null);
    setStopReason("");
    flash(`${r.drug} stopped.`);
  };

  return (
    <div className="space-y-5">
      {allergies.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <AlertTriangle size={16} /> Allergies: <span className="font-semibold">{allergies.join(", ")}</span>
        </p>
      )}

      <section className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Pill size={15} /> Active prescriptions ({active.length})</h3>
          {prescriber && !showForm && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={14} /> Prescribe
            </button>
          )}
        </div>

        {showForm && prescriber && (
          <form onSubmit={prescribe} className="space-y-3 border-b border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Drug" className="sm:col-span-2">
                <input className={inputClass} value={form.drug} onChange={(e) => setForm({ ...form, drug: e.target.value })} autoFocus />
              </Field>
              <Field label="Dose"><input className={inputClass} value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="e.g. 500 mg" /></Field>
              <Field label="Route">
                <select className={inputClass} value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}>
                  {RX_ROUTES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Frequency">
                <select className={inputClass} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  {FREQUENCIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Duration"><input className={inputClass} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 5 days" /></Field>
              <Field label="Instructions" className="sm:col-span-2"><input className={inputClass} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="e.g. after meals" /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={form.toPharmacy} onChange={(e) => setForm({ ...form, toPharmacy: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Send to pharmacy for dispensing (untick if given from ward stock)
              </label>
              <WhenField label="Prescribed at" value={when} onChange={setWhen} />
            </div>
            {allergyHit && (
              <p className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle size={15} /> Recorded allergy: {allergyHit}. You'll be asked to confirm.</p>
            )}
            {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Prescribed by <span className="font-medium text-slate-700">{me}</span></p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setFormError(""); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white">Cancel</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save prescription</button>
              </div>
            </div>
          </form>
        )}
        {!prescriber && <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">Only doctors can prescribe or stop medication.</p>}

        <ul className="divide-y divide-slate-100">
          {active.map((r) => {
            const last = lastGiven(r.id);
            const gap = FREQ_HOURS[r.frequency];
            const nextDue = last && gap ? last.at + gap * 3_600_000 : null;
            return (
              <li key={r.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.drug} · {r.dose} · {r.route}</p>
                    <p className="text-xs text-slate-500">{r.frequency} · {r.duration}{r.instructions && ` · ${r.instructions}`}</p>
                    <p className="mt-1 text-xs text-slate-500">Prescribed by <span className="font-medium text-slate-700">{r.prescribedBy}</span> on {fmtDateTime(r.prescribedAt)}</p>
                    <p className="text-xs text-slate-500">
                      {last ? <>Last given {fmtDateTime(last.at)} by <span className="font-medium text-slate-700">{last.administeredBy}</span></> : "Not yet given"}
                      {nextDue && ` · next due about ${fmtDateTime(nextDue)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canGive && giving !== r.id && (
                      <button onClick={() => startGiving(r)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"><Syringe size={13} /> Record administration</button>
                    )}
                    {prescriber && stopping !== r.id && (
                      <button onClick={() => { setStopping(r.id); setStopReason(""); }} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"><Ban size={13} /> Stop</button>
                    )}
                  </div>
                </div>

                {giving === r.id && (
                  <div className="space-y-3 rounded-lg bg-slate-50 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Outcome">
                        <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as AdminOutcome)}>
                          <option>Given</option>
                          <option>Held</option>
                          <option>Refused</option>
                        </select>
                      </Field>
                      <WhenField label="Date and time" value={giveWhen} onChange={setGiveWhen} />
                      <Field label={outcome === "Given" ? "Note (optional)" : "Reason (required)"}>
                        <input className={inputClass} value={giveNote} onChange={(e) => setGiveNote(e.target.value)} />
                      </Field>
                    </div>
                    {giveError && <p role="alert" className="text-sm text-rose-600">{giveError}</p>}
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">Administered by <span className="font-medium text-slate-700">{me}</span>{myRole && ` (${myRole})`} · ordered by {r.prescribedBy}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setGiving(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white">Cancel</button>
                        <button type="button" onClick={() => record(r)} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                      </div>
                    </div>
                  </div>
                )}

                {stopping === r.id && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-50 p-3">
                    <input className={`${inputClass} flex-1`} value={stopReason} onChange={(e) => setStopReason(e.target.value)} placeholder="Reason for stopping" aria-label="Reason for stopping" autoFocus />
                    <button type="button" onClick={() => setStopping(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">Cancel</button>
                    <button type="button" disabled={!stopReason.trim()} onClick={() => stop(r)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">Stop medication</button>
                  </div>
                )}
              </li>
            );
          })}
          {active.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">No active prescriptions.</li>}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200">
        <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Administration log ({log.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Date and time</th>
                <th className="px-4 py-2">Medication</th>
                <th className="px-4 py-2">Outcome</th>
                <th className="px-4 py-2">Administered by</th>
                <th className="px-4 py-2">Prescribed by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {log.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                    {fmtDateTime(a.at)}
                    {a.recordedAt - a.at > 15 * 60_000 && <span className="block text-xs text-slate-400">Documented {fmtDateTime(a.recordedAt)}</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-800">{a.drug} · {a.dose} · {a.route}{a.note && <span className="block text-xs text-slate-500">{a.note}</span>}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${outcomeStyle[a.outcome]}`}>{a.outcome}</span></td>
                  <td className="px-4 py-2 text-slate-700">{a.administeredBy}{a.administeredRole && <span className="block text-xs text-slate-400">{a.administeredRole}</span>}</td>
                  <td className="px-4 py-2 text-slate-700">{a.prescribedBy}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Nothing administered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {stopped.length > 0 && (
        <section className="rounded-lg border border-slate-200">
          <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Stopped prescriptions ({stopped.length})</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {stopped.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <p className="font-medium text-slate-700">{r.drug} · {r.dose} · {r.route} · {r.frequency}</p>
                <p className="text-xs text-slate-500">Prescribed by {r.prescribedBy} on {fmtDateTime(r.prescribedAt)}</p>
                <p className="text-xs text-slate-500">Stopped {r.stoppedAt ? fmtDateTime(r.stoppedAt) : ""} by {r.stoppedBy}: {r.stopReason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}