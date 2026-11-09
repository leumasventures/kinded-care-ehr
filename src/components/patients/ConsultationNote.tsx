import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Modal from "../billing/Modal";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/audit";
import { ageLabel, allergyList, loadPatients } from "../../types/patients";
import { FREQUENCIES, RX_ROUTES, allergyMatch, canPrescribe, fmtDateTime, loadRecords, saveRecords, uid, type ClinicalNote, type Prescription } from "../../types/records";
import { loadPriceList } from "../../types/pricing";
import { loadDrugs } from "../../types/pharmacy";
import { loadLabOrders, nextLabId, type LabOrder, type Priority } from "../../types/laboratory";
import { STORE_KEYS, saveStore } from "../../services/store";
import { chargeLabOrder } from "../../services/clinical";
import { latestTriage, loadTriage, triageFlags, triageText } from "../../types/triage";
import { todayISO } from "../../types/billing";
import { inputClass } from "./ui";

interface Target {
  id: string;
  patientId: string;
  patient: string;
  doctor: string;
  date: string;
  type: string;
  reason?: string;
  status: string;
}

interface RxDraft {
  key: number;
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}
const blankRx = (key: number): RxDraft => ({ key, drug: "", dose: "", route: "Oral", frequency: FREQUENCIES[2], duration: "5 days", instructions: "" });

const SECTIONS = [
  { key: "complaint", label: "Presenting complaint", rows: 2, placeholder: "Why the patient came, and for how long" },
  { key: "history", label: "History", rows: 2, placeholder: "Relevant history, medications, allergies (optional)" },
  { key: "exam", label: "Examination and findings", rows: 3, placeholder: "Vitals, examination, results seen" },
  { key: "diagnosis", label: "Diagnosis", rows: 2, placeholder: "Working or confirmed diagnosis" },
  { key: "plan", label: "Plan and treatment", rows: 3, placeholder: "Investigations, drugs, advice, follow-up" },
] as const;
type Key = (typeof SECTIONS)[number]["key"];

/** Written by the doctor from an appointment. It lands in the patient's chart as a Consultation note, linked back to the visit. */
export default function ConsultationNote({
  appointment,
  onSaved,
  onClose,
}: {
  appointment: Target;
  onSaved: (markCompleted: boolean, summary: string) => void;
  onClose: () => void;
}) {
  const { user, can } = useAuth();
  const me = user?.name ?? "Unknown user";
  const myRole = user?.roleName ?? "";
  const patient = useMemo(() => loadPatients().find((p) => p.id === appointment.patientId), [appointment.patientId]);
  const earlier = useMemo(
    () => loadRecords().notes.filter((n) => n.patientId === appointment.patientId && n.appointmentId === appointment.id && !n.addendumTo),
    [appointment.patientId, appointment.id]
  );

  const [v, setV] = useState<Record<Key, string>>({ complaint: appointment.reason ?? "", history: "", exam: "", diagnosis: "", plan: "" });
  const triage = useMemo(() => latestTriage(loadTriage(), appointment.id), [appointment.id]);
  const catalog = useMemo(() => loadPriceList().filter((p) => p.category === "Laboratory"), []);
  const drugNames = useMemo(() => loadDrugs().map((d) => d.name).sort(), []);
  const mayOrderLabs = can("Laboratory", "create");
  const mayPrescribe = canPrescribe(user);
  const [labFilter, setLabFilter] = useState("");
  const [labPicked, setLabPicked] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>("Routine");
  const [rxRows, setRxRows] = useState<RxDraft[]>([]);
  const [complete, setComplete] = useState(appointment.status !== "Completed");
  const [lock, setLock] = useState(false);
  const [error, setError] = useState("");

  const allergies = patient ? allergyList(patient) : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!patient) return setError("This patient is no longer on the register.");
    if (!v.diagnosis.trim() && !v.exam.trim() && !v.complaint.trim()) return setError("Write at least the complaint, findings or diagnosis.");
    const rxFilled = rxRows.filter((r) => r.drug.trim());
    if (rxFilled.some((r) => !r.dose.trim())) return setError("Every drug needs a dose.");
    const clash = rxFilled.find((r) => allergyMatch(r.drug, allergies));
    if (clash && !window.confirm(`${patient.name} has a recorded allergy (${allergies.join(", ")}) that may match ${clash.drug}. Prescribe anyway?`)) return;

    const chosenTests = catalog.filter((p) => labPicked.includes(p.id));
    const body = SECTIONS.filter((s) => v[s.key].trim())
      .map((s) => `${s.label}:\n${v[s.key].trim()}`)
      .join("\n\n");
    const orders = [
      chosenTests.length ? `Lab tests requested (${priority.toLowerCase()}): ${chosenTests.map((t) => t.name).join(", ")}` : "",
      ...rxFilled.map((r) => `Prescribed: ${r.drug.trim()} ${r.dose.trim()} ${r.route}, ${r.frequency}, ${r.duration.trim() || "until review"}${r.instructions.trim() ? `. ${r.instructions.trim()}` : ""}`),
    ].filter(Boolean);
    const text = [triage ? `Vitals at triage (${triage.by}): ${triageText(triage)}` : "", body, orders.length ? `Orders:\n${orders.join("\n")}` : ""].filter(Boolean).join("\n\n");
    const now = Date.now();
    const note: ClinicalNote = {
      id: uid(),
      patientId: patient.id,
      at: now,
      recordedAt: now,
      category: "Consultation",
      text,
      author: me,
      authorRole: myRole,
      appointmentId: appointment.id,
      ...(lock ? { locked: true, lockLog: [{ at: now, by: me, action: "locked" as const }] } : {}),
    };

    // Lab order: goes to the laboratory queue and onto the invoice. TODO: POST /lab-orders via a services/ call
    if (chosenTests.length) {
      const existing = loadLabOrders();
      const order: LabOrder = {
        id: nextLabId(existing),
        patientId: patient.id,
        patient: patient.name,
        requestedBy: appointment.doctor,
        date: todayISO(),
        priority,
        status: "Pending",
        clinicalNote: v.diagnosis.trim() || v.complaint.trim() || undefined,
        appointmentId: appointment.id,
        tests: chosenTests.map((p) => ({ id: p.id, name: p.name, price: p.price })),
      };
      saveStore(STORE_KEYS.labOrders, [order, ...existing]);
      chargeLabOrder(order);
      logAudit({ action: "Create", module: "Laboratory", summary: `Ordered ${chosenTests.length} lab test${chosenTests.length === 1 ? "" : "s"} for ${patient.name} (${patient.id}) from appointment ${appointment.id}` });
    }
    // Prescriptions: go to the chart (and the nurses' round if admitted) and wait in the pharmacy queue.
    const rec = loadRecords();
    const prescriptions: Prescription[] = rxFilled.map((r) => ({
      id: uid(), patientId: patient.id, drug: r.drug.trim(), dose: r.dose.trim(), route: r.route, frequency: r.frequency, duration: r.duration.trim() || "Until review",
      instructions: r.instructions.trim(), prescribedAt: now, prescribedBy: me, status: "Active", appointmentId: appointment.id, toDispense: true,
    }));
    // TODO: POST /patients/:id/notes and /prescriptions via a services/ call
    saveRecords({ ...rec, notes: [...rec.notes, note], prescriptions: [...rec.prescriptions, ...prescriptions] });
    // The note text itself is never written to the audit log.
    logAudit({ action: "Create", module: "Clinical notes", summary: `Wrote a consultation note for ${patient.name} (${patient.id}) from appointment ${appointment.id}${lock ? " and locked it" : ""}` });
    if (prescriptions.length) logAudit({ action: "Create", module: "Prescriptions", summary: `Prescribed ${prescriptions.length} drug${prescriptions.length === 1 ? "" : "s"} for ${patient.name} (${patient.id}) from appointment ${appointment.id}` });
    const bits = [chosenTests.length && `${chosenTests.length} lab test${chosenTests.length === 1 ? "" : "s"} ordered`, prescriptions.length && `${prescriptions.length} drug${prescriptions.length === 1 ? "" : "s"} sent to pharmacy`].filter(Boolean);
    onSaved(complete, `Consultation note saved to ${patient.name}'s chart${bits.length ? `; ${bits.join(", ")}` : ""}.`);
  };

  return (
    <Modal title={`Consultation note · ${appointment.patient}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <p className="font-medium text-slate-800">
            {appointment.patient}
            {patient && <span className="font-normal text-slate-500"> · {patient.id} · {ageLabel(patient.dob)} · {patient.gender}</span>}
          </p>
          <p className="text-xs text-slate-500">
            {appointment.id} · {appointment.type} with {appointment.doctor} · {appointment.date} · {appointment.status}
          </p>
        </div>

        {allergies.length > 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle size={15} /> Known allergies: {allergies.join(", ")}
          </p>
        )}
        {earlier.length > 0 && (
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            A consultation note for this visit already exists ({earlier.map((n) => `${n.author}, ${fmtDateTime(n.recordedAt)}`).join("; ")}). Saving adds another. To correct that one, add an addendum in the{" "}
            <Link to={`/patients?open=${appointment.patientId}`} className="font-medium underline">patient's chart</Link>.
          </p>
        )}

        {triage ? (
          <div className="rounded-lg border border-slate-200 px-4 py-3 text-sm">
            <p className="font-medium text-slate-700">Vitals at check-in <span className="font-normal text-slate-400">· {triage.by}, {fmtDateTime(triage.at)}</span></p>
            <p className="text-slate-700">{triageText(triage)}</p>
            {triageFlags(triage).length > 0 && <p className="mt-1 flex items-center gap-1.5 text-amber-800"><AlertTriangle size={14} /> {triageFlags(triage).join(", ")}</p>}
            {triage.note && <p className="text-xs text-slate-500">Nurse: {triage.note}</p>}
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No vitals were recorded at check-in for this visit.</p>
        )}

        {SECTIONS.map((s) => (
          <label key={s.key} className="block text-sm">
            <span className="mb-1 block text-slate-600">{s.label}</span>
            <textarea className={inputClass} rows={s.rows} value={v[s.key]} placeholder={s.placeholder} onChange={(e) => setV((x) => ({ ...x, [s.key]: e.target.value }))} autoFocus={s.key === "complaint"} />
          </label>
        ))}


        {mayOrderLabs && (
          <fieldset className="space-y-2 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Order lab tests</legend>
            <div className="flex flex-wrap items-center gap-3">
              <input className={`${inputClass} max-w-xs`} value={labFilter} onChange={(e) => setLabFilter(e.target.value)} placeholder="Search tests" aria-label="Search lab tests" />
              <select className={`${inputClass} w-auto`} value={priority} onChange={(e) => setPriority(e.target.value as Priority)} aria-label="Priority">
                <option>Routine</option>
                <option>Urgent</option>
              </select>
            </div>
            {labPicked.length > 0 && (
              <p className="flex flex-wrap gap-1.5">
                {catalog.filter((p) => labPicked.includes(p.id)).map((p) => (
                  <button key={p.id} type="button" onClick={() => setLabPicked((x) => x.filter((i) => i !== p.id))} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">{p.name} ×</button>
                ))}
              </p>
            )}
            {labFilter.trim() && (
              <ul className="max-h-36 overflow-y-auto rounded-lg border border-slate-100 text-sm">
                {catalog.filter((p) => p.name.toLowerCase().includes(labFilter.trim().toLowerCase()) && !labPicked.includes(p.id)).slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setLabPicked((x) => [...x, p.id]); setLabFilter(""); }} className="flex w-full justify-between px-3 py-1.5 text-left hover:bg-slate-50"><span>{p.name}</span></button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-500">Goes to the laboratory queue and is added to the patient's invoice.</p>
          </fieldset>
        )}

        {mayPrescribe && (
          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Prescribe</legend>
            <datalist id="consult-drugs">{drugNames.map((d) => <option key={d} value={d} />)}</datalist>
            {rxRows.map((r) => {
              const set = (patch: Partial<RxDraft>) => setRxRows((rows) => rows.map((x) => (x.key === r.key ? { ...x, ...patch } : x)));
              const hit = allergyMatch(r.drug, allergies);
              return (
                <div key={r.key} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-6">
                  <input className={`${inputClass} sm:col-span-3`} list="consult-drugs" placeholder="Drug" aria-label="Drug" value={r.drug} onChange={(e) => set({ drug: e.target.value })} />
                  <input className={`${inputClass} sm:col-span-1`} placeholder="Dose" aria-label="Dose" value={r.dose} onChange={(e) => set({ dose: e.target.value })} />
                  <select className={`${inputClass} sm:col-span-2`} aria-label="Route" value={r.route} onChange={(e) => set({ route: e.target.value })}>{RX_ROUTES.map((x) => <option key={x}>{x}</option>)}</select>
                  <select className={`${inputClass} sm:col-span-3`} aria-label="Frequency" value={r.frequency} onChange={(e) => set({ frequency: e.target.value })}>{FREQUENCIES.map((x) => <option key={x}>{x}</option>)}</select>
                  <input className={`${inputClass} sm:col-span-2`} placeholder="Duration, e.g. 5 days" aria-label="Duration" value={r.duration} onChange={(e) => set({ duration: e.target.value })} />
                  <button type="button" onClick={() => setRxRows((rows) => rows.filter((x) => x.key !== r.key))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 sm:col-span-1">Remove</button>
                  <input className={`${inputClass} sm:col-span-6`} placeholder="Instructions for the patient or nurse (optional)" aria-label="Instructions" value={r.instructions} onChange={(e) => set({ instructions: e.target.value })} />
                  {hit && <p className="flex items-center gap-1.5 text-xs font-medium text-rose-700 sm:col-span-6"><AlertTriangle size={13} /> Recorded allergy: {hit}</p>}
                </div>
              );
            })}
            <button type="button" onClick={() => setRxRows((rows) => [...rows, blankRx((rows[rows.length - 1]?.key ?? 0) + 1)])} className="text-sm font-medium text-blue-600 hover:underline">+ Add a drug</button>
            <p className="text-xs text-slate-500">Goes to the pharmacy's waiting list. If the patient is admitted, it also appears on the nurses' medication round.</p>
          </fieldset>
        )}

        <div className="space-y-1">
          {appointment.status !== "Completed" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Mark this appointment as completed
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Lock the note now (otherwise you can edit it for 24 hours)
          </label>
        </div>

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Save note</button>
        </div>
      </form>
    </Modal>
  );
}