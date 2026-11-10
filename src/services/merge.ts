// Merging two registrations of the same person. Every record that points at the duplicate is moved to the patient being kept,
// the duplicate is removed from the register, and a merge log keeps a copy of what was removed.
// TODO: this must be one database transaction on the backend, and the merge log must be append-only.
import { STORE_KEYS, loadStore, saveStore } from "./store";
import { logAudit } from "./audit";
import { loadAppointments, type Appointment } from "../types/appointments";
import { loadAdmissions, type Admission } from "../types/admissions";
import { loadLabOrders, type LabOrder } from "../types/laboratory";
import { loadDispensing, type Dispensing } from "../types/pharmacy";
import { loadInvoices, type Invoice } from "../types/billing";
import { loadTriage, saveTriage, type Triage } from "../types/triage";
import { loadDocuments, saveDocuments, type IssuedDoc } from "../types/documents";
import { loadRecords, saveRecords, uid } from "../types/records";
import { loadPatients, savePatients, type Patient } from "../types/patients";
import { loadClaims, saveClaims } from "../types/claims";

export interface MergeLogEntry {
  id: string;
  at: number;
  by: string;
  keptId: string;
  removed: Patient; // full copy of the duplicate registration
  moved: Record<string, number>;
}

export const loadMergeLog = (): MergeLogEntry[] => loadStore<MergeLogEntry[]>(STORE_KEYS.patientMerges, () => []);

export type RecordCounts = Record<string, number>;

/** How many records of each kind belong to a patient, shown before a merge so the admin can see what will move. */
export function recordCounts(patientId: string): RecordCounts {
  const rec = loadRecords();
  const mine = <T extends { patientId?: string }>(rows: T[]) => rows.filter((r) => r.patientId === patientId).length;
  return {
    Appointments: mine(loadAppointments()),
    Admissions: mine(loadAdmissions()),
    "Lab orders": mine(loadLabOrders()),
    Dispensing: mine(loadDispensing()),
    Invoices: mine(loadInvoices()),
    "Clinical notes": mine(rec.notes),
    Prescriptions: mine(rec.prescriptions),
    Documents: mine(loadDocuments()),
  };
}

/** Returns a reason the two registrations can't be merged, or null when it is safe to go ahead. */
export function mergeBlocker(keep: Patient, dupe: Patient): string | null {
  if (keep.id === dupe.id) return "Choose two different patients.";
  const admitted = (id: string) => loadAdmissions().some((a) => a.patientId === id && a.status === "Admitted");
  if (admitted(keep.id) && admitted(dupe.id)) return "Both registrations are currently admitted. Discharge one of them first.";
  return null;
}

const unionAllergies = (a: string, b: string) => {
  const seen = new Set<string>();
  return [...a.split(","), ...b.split(",")]
    .map((x) => x.trim())
    .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
    .join(", ");
};

export function mergePatients(keepId: string, dupeId: string, by: string): { ok: true; moved: Record<string, number> } | { ok: false; reason: string } {
  const patients = loadPatients();
  const keep = patients.find((p) => p.id === keepId);
  const dupe = patients.find((p) => p.id === dupeId);
  if (!keep || !dupe) return { ok: false, reason: "One of the patients is no longer on the register." };
  const blocked = mergeBlocker(keep, dupe);
  if (blocked) return { ok: false, reason: blocked };

  const moved: Record<string, number> = {};
  const move = <T extends { patientId: string }>(label: string, rows: T[], fix: (r: T) => T): T[] =>
    rows.map((r) => {
      if (r.patientId !== dupe.id) return r;
      moved[label] = (moved[label] ?? 0) + 1;
      return fix({ ...r, patientId: keep.id });
    });

  saveStore(STORE_KEYS.appointments, move<Appointment>("Appointments", loadAppointments(), (r) => ({ ...r, patient: keep.name })));
  saveStore(STORE_KEYS.admissions, move<Admission>("Admissions", loadAdmissions(), (r) => ({ ...r, patient: keep.name })));
  saveStore(STORE_KEYS.labOrders, move<LabOrder>("Lab orders", loadLabOrders(), (r) => ({ ...r, patient: keep.name })));
  saveStore(STORE_KEYS.dispensing, move<Dispensing>("Dispensing", loadDispensing(), (r) => ({ ...r, patient: keep.name })));
  saveStore(STORE_KEYS.invoices, move<Invoice>("Invoices", loadInvoices(), (r) => ({ ...r, patient: keep.name, patientPhone: keep.phone || r.patientPhone })));
  // Insurance claims list the patient on each invoice line.
  saveClaims(
    loadClaims().map((c) => {
      if (!c.lines.some((l) => l.patientId === dupe.id)) return c;
      moved["Claim lines"] = (moved["Claim lines"] ?? 0) + c.lines.filter((l) => l.patientId === dupe.id).length;
      return { ...c, lines: c.lines.map((l) => (l.patientId === dupe.id ? { ...l, patientId: keep.id, patient: keep.name, memberId: l.memberId ?? keep.memberId } : l)) };
    })
  );
  saveTriage(move<Triage>("Triage readings", loadTriage(), (r) => r));
  saveDocuments(move<IssuedDoc>("Documents", loadDocuments(), (r) => ({ ...r, patientName: keep.name })));
  const rec = loadRecords();
  saveRecords({
    notes: move("Clinical notes", rec.notes, (r) => r),
    prescriptions: move("Prescriptions", rec.prescriptions, (r) => r),
    administrations: move("Administrations", rec.administrations, (r) => r),
  });

  const unknown = (v: string) => !v || v === "Unknown";
  const merged: Patient = {
    ...keep,
    phone: keep.phone || dupe.phone,
    address: keep.address || dupe.address,
    bloodGroup: unknown(keep.bloodGroup) ? dupe.bloodGroup : keep.bloodGroup,
    genotype: unknown(keep.genotype) ? dupe.genotype : keep.genotype,
    allergies: unionAllergies(keep.allergies, dupe.allergies),
    kinName: keep.kinName || dupe.kinName,
    kinRelation: keep.kinName ? keep.kinRelation : dupe.kinRelation,
    kinPhone: keep.kinPhone || dupe.kinPhone,
    payerName: keep.payerName || dupe.payerName,
    memberId: keep.memberId || dupe.memberId,
    notes: [keep.notes, dupe.notes].filter(Boolean).join("\n") || undefined,
    registeredOn: keep.registeredOn < dupe.registeredOn ? keep.registeredOn : dupe.registeredOn,
    mergedFrom: [...(keep.mergedFrom ?? []), dupe.id],
  };
  savePatients(patients.filter((p) => p.id !== dupe.id).map((p) => (p.id === keep.id ? merged : p)));

  saveStore<MergeLogEntry[]>(STORE_KEYS.patientMerges, [...loadMergeLog(), { id: uid(), at: Date.now(), by, keptId: keep.id, removed: dupe, moved }]);
  const total = Object.values(moved).reduce((s, n) => s + n, 0);
  logAudit({
    action: "Update",
    module: "Patients",
    summary: `Merged duplicate ${dupe.name} (${dupe.id}) into ${keep.name} (${keep.id}), moving ${total} record${total === 1 ? "" : "s"}`,
    detail: Object.entries(moved).map(([k, n]) => `${k}: ${n}`).join("\n") || "No linked records",
    dedupeMs: 0,
  });
  return { ok: true, moved };
}