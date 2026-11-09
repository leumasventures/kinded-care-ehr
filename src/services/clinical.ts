// Glue between modules: what a lab order costs, and getting its results into the patient's chart.
import { logAudit } from "./audit";
import { addCharges, type ChargeResult } from "./charges";
import { loadPatients } from "../types/patients";
import { fmtDateTime, loadRecords, saveRecords, uid, type ClinicalNote } from "../types/records";
import type { LabOrder } from "../types/laboratory";
import type { Admission } from "../types/admissions";
import type { MedOrder, Route } from "../types/nursing";
import type { PatientRecords, Prescription } from "../types/records";

export function chargeLabOrder(o: LabOrder): ChargeResult | null {
  const person = loadPatients().find((p) => p.id === o.patientId);
  if (!person) return null;
  return addCharges(
    person,
    `lab:${o.id}`,
    o.tests.map((t) => ({ description: t.name, qty: 1, unitPrice: t.price })),
    `lab order ${o.id}`
  );
}

/** Writes a "Lab result" note into the patient's chart when results are ready. Re-entered results are added as an addendum. */
export function postLabResultToChart(o: LabOrder, by: { name: string; role: string }) {
  const lines = o.tests.map((t) => `${t.name}: ${t.result?.trim() || "no result entered"}${t.unit ? ` ${t.unit}` : ""}${t.flag && t.flag !== "Normal" ? ` [${t.flag}]` : ""}`);
  const text = `Lab order ${o.id} (requested by ${o.requestedBy}, ${o.date}):\n${lines.join("\n")}`;
  const rec = loadRecords();
  const first = rec.notes.find((n) => n.labOrderId === o.id && !n.addendumTo);
  const now = Date.now();
  const note: ClinicalNote = {
    id: uid(),
    patientId: o.patientId,
    at: now,
    recordedAt: now,
    category: "Lab result",
    text: first ? `Results updated ${fmtDateTime(now)}:\n${lines.join("\n")}` : text,
    author: by.name,
    authorRole: by.role,
    labOrderId: o.id,
    appointmentId: o.appointmentId,
    ...(first ? { addendumTo: first.id } : {}),
  };
  // TODO: POST /patients/:id/notes via a services/ call (the backend should do this when results are verified)
  saveRecords({ ...rec, notes: [...rec.notes, note] });
  logAudit({ action: "Create", module: "Clinical notes", summary: `Lab results for order ${o.id} posted to ${o.patient}'s chart (${o.patientId})` });
}

// ---- Nurses' medication round, built from the doctors' prescriptions ----
const SLOTS_BY_FREQUENCY: Record<string, string[]> = {
  "Once daily": ["08:00"],
  "Twice daily (BD)": ["08:00", "20:00"],
  "Three times daily (TDS)": ["08:00", "14:00", "20:00"],
  "Four times daily (QDS)": ["06:00", "12:00", "18:00", "22:00"],
  "Every 8 hours": ["06:00", "14:00", "22:00"],
  "Every 12 hours": ["08:00", "20:00"],
  "At night": ["21:00"],
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const hhmmOf = (ms: number) => `${pad2(new Date(ms).getHours())}:${pad2(new Date(ms).getMinutes())}`;

function endsOn(rx: Prescription): string | null {
  const m = rx.duration.match(/(\d+)\s*(day|week)/i);
  if (!m) return null; // "Ongoing" and anything we can't read keeps going until a doctor stops it
  const d = new Date(rx.prescribedAt);
  d.setDate(d.getDate() + Number(m[1]) * (/week/i.test(m[2]) ? 7 : 1) - 1);
  return isoOf(d.getTime());
}

/** Today's doses for every admitted patient's active prescriptions. "As needed" drugs are given from the chart, not scheduled. */
export function medRound(admitted: Admission[], rec: PatientRecords, today: string): MedOrder[] {
  const out: MedOrder[] = [];
  for (const adm of admitted) {
    for (const rx of rec.prescriptions) {
      if (rx.patientId !== adm.patientId || rx.status !== "Active") continue;
      const last = endsOn(rx);
      if (last && today > last) continue;
      const stat = rx.frequency === "Stat (once)";
      const slots = stat ? [hhmmOf(rx.prescribedAt)] : SLOTS_BY_FREQUENCY[rx.frequency] ?? [];
      if (stat && isoOf(rx.prescribedAt) !== today && !rec.administrations.some((a) => a.prescriptionId === rx.id)) continue;
      for (const slot of slots) {
        const done = rec.administrations.find((a) => a.prescriptionId === rx.id && a.slot === slot && (stat || isoOf(a.at) === today));
        out.push({
          id: `${rx.id}@${slot}`,
          rxId: rx.id,
          admissionId: adm.id,
          drug: rx.drug,
          dose: rx.dose,
          route: (rx.route as Route),
          time: slot,
          status: done ? done.outcome : "Due",
          ...(done ? { doneAt: done.at, doneBy: done.administeredBy } : {}),
        });
      }
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}