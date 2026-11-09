import { useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../billing/Modal";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/audit";
import { loadTriage, saveTriage, triageFlags, type Triage } from "../../types/triage";
import { uid } from "../../types/records";
import { inputClass } from "./ui";

type Draft = Record<"temp" | "systolic" | "diastolic" | "pulse" | "resp" | "spo2" | "weight" | "height", string>;

const FIELDS: { key: keyof Draft; label: string; unit: string; step?: string; min: number; max: number }[] = [
  { key: "temp", label: "Temperature", unit: "°C", step: "0.1", min: 30, max: 45 },
  { key: "systolic", label: "BP systolic", unit: "mmHg", min: 40, max: 300 },
  { key: "diastolic", label: "BP diastolic", unit: "mmHg", min: 20, max: 200 },
  { key: "pulse", label: "Pulse", unit: "/min", min: 20, max: 250 },
  { key: "resp", label: "Respiratory rate", unit: "/min", min: 4, max: 80 },
  { key: "spo2", label: "Oxygen (SpO2)", unit: "%", min: 50, max: 100 },
  { key: "weight", label: "Weight", unit: "kg", step: "0.1", min: 0.3, max: 400 },
  { key: "height", label: "Height", unit: "cm", step: "0.1", min: 30, max: 250 },
];

export default function TriageForm({
  appointment,
  onSaved,
  onClose,
}: {
  appointment: { id: string; patientId: string; patient: string };
  onSaved: (t: Triage) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [v, setV] = useState<Draft>({ temp: "", systolic: "", diastolic: "", pulse: "", resp: "", spo2: "", weight: "", height: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const num = (k: keyof Draft) => (v[k].trim() === "" ? undefined : Number(v[k]));
  const draft: Triage = {
    id: uid(), appointmentId: appointment.id, patientId: appointment.patientId, at: Date.now(), by: user?.name ?? "Unknown", role: user?.roleName ?? "",
    temp: num("temp"), systolic: num("systolic"), diastolic: num("diastolic"), pulse: num("pulse"), resp: num("resp"), spo2: num("spo2"), weight: num("weight"), height: num("height"),
    note: note.trim() || undefined,
  };
  const flags = triageFlags(draft);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    for (const f of FIELDS) {
      const n = num(f.key);
      if (n !== undefined && (!Number.isFinite(n) || n < f.min || n > f.max)) return setError(`${f.label} should be between ${f.min} and ${f.max} ${f.unit}.`);
    }
    if ((draft.systolic === undefined) !== (draft.diastolic === undefined)) return setError("Enter both blood pressure numbers, or neither.");
    if (draft.systolic !== undefined && draft.diastolic !== undefined && draft.diastolic >= draft.systolic) return setError("Diastolic pressure must be lower than systolic.");
    if (FIELDS.every((f) => num(f.key) === undefined)) return setError("Enter at least one reading.");
    // TODO: POST /appointments/:id/triage via a services/ call
    saveTriage([...loadTriage(), draft]);
    logAudit({ action: "Create", module: "Triage", summary: `Recorded triage vitals for ${appointment.patient} (${appointment.patientId}), appointment ${appointment.id}` });
    onSaved(draft);
  };

  return (
    <Modal title={`Vitals · ${appointment.patient}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map((f, i) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block text-slate-600">{f.label} <span className="text-slate-400">({f.unit})</span></span>
              <input type="number" inputMode="decimal" step={f.step ?? "1"} className={inputClass} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))} autoFocus={i === 0} />
            </label>
          ))}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Nurse's note (optional)</span>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Patient anxious, came by wheelchair" />
        </label>
        {flags.length > 0 && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle size={15} /> Needs attention: {flags.join(", ")}. Tell the doctor before the consultation.</p>
        )}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Save vitals</button>
        </div>
      </form>
    </Modal>
  );
}