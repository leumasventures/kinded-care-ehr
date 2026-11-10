import type { AuthUser } from "../context/AuthContext";

export const NOTE_CATEGORIES = ["Progress note", "Consultation", "Procedure", "Nursing note", "Handover", "Lab result", "Other"] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const RX_ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "Rectal", "Other"] as const;
export const FREQUENCIES = ["Stat (once)", "Once daily", "Twice daily (BD)", "Three times daily (TDS)", "Four times daily (QDS)", "Every 8 hours", "Every 12 hours", "At night", "As needed (PRN)"] as const;

export type RxStatus = "Active" | "Stopped";
export type AdminOutcome = "Given" | "Held" | "Refused";

/** Clinical notes are never edited or deleted. Corrections are added as addenda so the record stays auditable. */
export interface ClinicalNote {
  id: string;
  patientId: string;
  at: number; // when the event happened (ms)
  recordedAt: number; // when it was written up (ms)
  category: NoteCategory;
  text: string;
  author: string;
  authorRole: string;
  addendumTo?: string; // id of the note this corrects or adds to
  appointmentId?: string; // set when the note was written from an appointment
  labOrderId?: string; // set on notes posted automatically from a lab result
  /** Explicit lock state. When unset, the note locks itself NOTE_EDIT_WINDOW_HOURS after it was written. */
  locked?: boolean;
  lockLog?: LockEvent[];
  /** Earlier versions of the text, kept for audit whenever an open note is edited. */
  revisions?: NoteRevision[];
}

export interface LockEvent {
  at: number;
  by: string;
  action: "locked" | "unlocked";
  reason?: string;
}

export interface NoteRevision {
  at: number; // when this version was replaced
  by: string; // who replaced it
  text: string;
  category: NoteCategory;
}

export const NOTE_EDIT_WINDOW_HOURS = 24;
const WINDOW_MS = NOTE_EDIT_WINDOW_HOURS * 3_600_000;

/** Locked notes are final: they can't be edited, and corrections are made as addenda. Addenda are final as soon as they're saved. */
export const isNoteLocked = (n: ClinicalNote, now = Date.now()) => !!n.addendumTo || (n.locked ?? now - n.recordedAt > WINDOW_MS);
export const lockDeadline = (n: ClinicalNote) => n.recordedAt + WINDOW_MS;

export function lockSummary(n: ClinicalNote, now = Date.now()): string {
  if (n.addendumTo) return "Addenda are final when saved.";
  const last = n.lockLog?.[n.lockLog.length - 1];
  if (isNoteLocked(n, now)) {
    if (last?.action === "locked") return `Locked ${fmtDateTime(last.at)} by ${last.by}.`;
    return `Locked automatically ${fmtDateTime(lockDeadline(n))}, ${NOTE_EDIT_WINDOW_HOURS} hours after it was written.`;
  }
  if (last?.action === "unlocked") return `Unlocked ${fmtDateTime(last.at)} by ${last.by}${last.reason ? `: ${last.reason}` : ""}. Lock it again when finished.`;
  return `Open for editing by its author until ${fmtDateTime(lockDeadline(n))}, or until locked.`;
}

export interface Prescription {
  id: string;
  patientId: string;
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedAt: number;
  prescribedBy: string; // doctor
  status: RxStatus;
  stoppedAt?: number;
  stoppedBy?: string;
  stopReason?: string;
  appointmentId?: string; // set when prescribed from a consultation
  /** Prescribed from a consultation and waiting at the pharmacy until dispensedAt is set. */
  toDispense?: boolean;
  dispensedAt?: number;
  dispensedBy?: string;
}

export interface Administration {
  id: string;
  prescriptionId: string;
  patientId: string;
  at: number; // when it was given (ms)
  recordedAt: number; // when it was documented (ms)
  outcome: AdminOutcome;
  // Snapshot of the order at the time, so the log still reads correctly if the order is changed later.
  drug: string;
  dose: string;
  route: string;
  prescribedBy: string; // doctor who ordered it
  administeredBy: string; // nurse or doctor who gave it
  administeredRole: string;
  note?: string;
  slot?: string; // scheduled time ("08:00") this dose belonged to, set when given from the nurses' round
}

export interface PatientRecords {
  notes: ClinicalNote[];
  prescriptions: Prescription[];
  administrations: Administration[];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const pad = (n: number) => String(n).padStart(2, "0");
/** Value for <input type="datetime-local"> in the user's local time. */
export const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => new Date(v).getTime();

/** Only doctors (and administrators) may prescribe or stop medication. */
export const canPrescribe = (user: AuthUser | null) => !!user && (user.isAdmin || /doctor|physician|consultant/i.test(user.roleName));

/** True if the drug name overlaps with one of the patient's recorded allergies. */
export const allergyMatch = (drug: string, allergies: string[]) => {
  const d = drug.trim().toLowerCase();
  if (!d) return null;
  return allergies.find((a) => {
    const x = a.trim().toLowerCase();
    return x.length >= 3 && (d.includes(x) || x.includes(d));
  }) ?? null;
};

// ---- Mock store (browser localStorage) ----
// TODO: replace with services/ calls (GET/POST /patients/:id/notes, /prescriptions, /administrations).
const KEY = "hms_records";
const ago = (hours: number) => Date.now() - hours * 3_600_000;

const n = (patientId: string, hours: number, category: NoteCategory, text: string, author: string, authorRole: string): ClinicalNote => ({
  id: uid(), patientId, at: ago(hours), recordedAt: ago(hours), category, text, author, authorRole,
});
const rx = (patientId: string, hours: number, drug: string, dose: string, route: string, frequency: string, duration: string, by: string, instructions = ""): Prescription => ({
  id: uid(), patientId, drug, dose, route, frequency, duration, instructions, prescribedAt: ago(hours), prescribedBy: by, status: "Active",
});
const ad = (p: Prescription, hours: number, by: string, role: string, outcome: AdminOutcome = "Given", note?: string): Administration => ({
  id: uid(), prescriptionId: p.id, patientId: p.patientId, at: ago(hours), recordedAt: ago(hours), outcome,
  drug: p.drug, dose: p.dose, route: p.route, prescribedBy: p.prescribedBy, administeredBy: by, administeredRole: role, note,
});

function seed(): PatientRecords {
  const r1 = rx("P-1001", 30, "Ceftriaxone", "1 g", "IV", "Twice daily (BD)", "5 days", "Dr. Eze", "Review sensitivity results on day 3.");
  const r2 = rx("P-1001", 30, "Paracetamol", "1 g", "Oral", "Every 8 hours", "3 days", "Dr. Eze");
  const r3 = rx("P-1003", 6, "Amlodipine", "10 mg", "Oral", "Once daily", "Ongoing", "Dr. Eze");
  return {
    notes: [
      n("P-1001", 30, "Consultation", "Presented with 3 days of fever, cough and chest pain. Chest crackles at the right base. Admitted for IV antibiotics. Chest X-ray requested.", "Dr. Eze", "Doctor"),
      n("P-1001", 9, "Nursing note", "Febrile overnight, tepid sponging done. Taking oral fluids well.", "Chioma Nurse", "Nurse"),
      n("P-1001", 4, "Progress note", "Fever settling. Chest sounds improving. Continue current antibiotics.", "Dr. Eze", "Doctor"),
      n("P-1003", 6, "Consultation", "Blood pressure 168/102 at review. Headache, no neurological deficit. Start amlodipine and recheck in 2 hours.", "Dr. Eze", "Doctor"),
    ],
    prescriptions: [r1, r2, r3],
    administrations: [
      ad(r1, 28, "Chioma Nurse", "Nurse"),
      ad(r1, 16, "Chioma Nurse", "Nurse"),
      ad(r1, 4, "Chioma Nurse", "Nurse"),
      ad(r2, 20, "Chioma Nurse", "Nurse"),
      ad(r2, 12, "Chioma Nurse", "Nurse", "Held", "Temperature normal at the time; held until next round."),
      ad(r3, 5, "Chioma Nurse", "Nurse"),
    ],
  };
}

export function loadRecords(): PatientRecords {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && Array.isArray(raw.notes) && Array.isArray(raw.prescriptions) && Array.isArray(raw.administrations)) return raw as PatientRecords;
  } catch {
    /* ignore */
  }
  return seed();
}

export function saveRecords(r: PatientRecords) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage unavailable: changes last until refresh */
  }
}