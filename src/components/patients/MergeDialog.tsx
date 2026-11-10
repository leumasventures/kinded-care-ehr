import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../billing/Modal";
import { useAuth } from "../../context/AuthContext";
import { mergeBlocker, mergePatients, recordCounts } from "../../services/merge";
import { ageLabel, type Patient } from "../../types/patients";
import PatientPicker from "./PatientPicker";

function Card({ p, keep, onKeep }: { p: Patient; keep: boolean; onKeep: () => void }) {
  const counts = useMemo(() => recordCounts(p.id), [p.id]);
  const shown = Object.entries(counts).filter(([, n]) => n > 0);
  return (
    <label className={`block cursor-pointer rounded-lg border p-4 text-sm ${keep ? "border-blue-500 bg-blue-50/40" : "border-slate-200"}`}>
      <span className="flex items-center gap-2">
        <input type="radio" name="keep" checked={keep} onChange={onKeep} className="h-4 w-4 text-blue-600" />
        <span className="font-semibold text-slate-800">{keep ? "Keep this record" : "Merge into the other"}</span>
      </span>
      <p className="mt-2 font-medium text-slate-800">{p.name}</p>
      <p className="text-xs text-slate-500">{p.id} · {ageLabel(p.dob)} · {p.gender} · born {p.dob}</p>
      <p className="text-xs text-slate-500">{p.phone || "No phone"} · registered {p.registeredOn}</p>
      <p className="mt-2 text-xs text-slate-600">{shown.length ? shown.map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ") : "No linked records"}</p>
    </label>
  );
}

/** Admin-only: pick the other registration, choose which one to keep, and merge. */
export default function MergeDialog({ patient, onDone, onClose }: { patient: Patient; onDone: (message: string) => void; onClose: () => void }) {
  const { user } = useAuth();
  const [other, setOther] = useState<Patient | null>(null);
  const [keepId, setKeepId] = useState(patient.id);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  const keep = other ? (keepId === patient.id ? patient : other) : null;
  const dupe = other ? (keepId === patient.id ? other : patient) : null;
  const blocker = keep && dupe ? mergeBlocker(keep, dupe) : null;

  const choose = (p: Patient | null) => {
    setOther(p);
    setTyped("");
    setError("");
    // By default keep the older registration (the lower hospital number).
    if (p) setKeepId(parseInt(p.id.replace(/\D/g, ""), 10) < parseInt(patient.id.replace(/\D/g, ""), 10) ? p.id : patient.id);
  };

  const run = () => {
    if (!keep || !dupe || typed !== "MERGE") return;
    const res = mergePatients(keep.id, dupe.id, user?.name ?? "Unknown user");
    if (!res.ok) return setError(res.reason);
    const n = Object.values(res.moved).reduce((s, x) => s + x, 0);
    onDone(`${dupe.name} (${dupe.id}) was merged into ${keep.name} (${keep.id}). ${n} record${n === 1 ? "" : "s"} moved.`);
  };

  return (
    <Modal title={`Merge duplicate of ${patient.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Use this when the same person was registered twice. All their visits, notes, prescriptions, lab orders and invoices move to the record you keep, and the other registration is removed.</p>
        <PatientPicker label="The other registration of this person" value={other} onChange={choose} exclude={patient.id} autoFocus />

        {keep && dupe && other && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card p={patient} keep={keepId === patient.id} onKeep={() => setKeepId(patient.id)} />
              <Card p={other} keep={keepId === other.id} onKeep={() => setKeepId(other.id)} />
            </div>
            <p className="text-xs text-slate-500">Missing details (phone, address, next of kin, blood group, insurer) are filled in from the removed record, and allergies from both are combined. A copy of the removed record is kept in the merge log.</p>
            {(keep.dob !== dupe.dob || keep.name.toLowerCase() !== dupe.name.toLowerCase()) && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> The names or birth dates differ. Check that these really are the same person. A wrong merge puts one person's records in another's chart and can't be undone automatically.
              </p>
            )}
            {blocker && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{blocker}</p>}
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type MERGE to confirm" aria-label="Type MERGE to confirm" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={typed !== "MERGE" || !!blocker} onClick={run} className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40">Merge</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}