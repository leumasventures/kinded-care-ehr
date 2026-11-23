import { loadAdmissions, type Admission } from "./admissions";

export const VITALS_DUE_HOURS = 6;

export interface Vitals {
  id: string;
  admissionId: string;
  recordedAt: number; // ms since epoch
  recordedBy: string;
  temp?: number; // °C
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  resp?: number;
  spo2?: number;
  note?: string;
}

/**
 * Simple attention flags to help nurses spot patients who need review.
 * They are a guide only. Always use clinical judgement and your hospital's early-warning protocol.
 */
export function vitalFlags(v: Vitals): string[] {
  const f: string[] = [];
  if (v.temp !== undefined) {
    if (v.temp >= 38) f.push("Fever");
    else if (v.temp <= 35.5) f.push("Low temperature");
  }
  if (v.spo2 !== undefined && v.spo2 < 94) f.push("Low SpO₂");
  if (v.pulse !== undefined) {
    if (v.pulse > 110) f.push("Fast pulse");
    else if (v.pulse < 50) f.push("Slow pulse");
  }
  if (v.systolic !== undefined || v.diastolic !== undefined) {
    if ((v.systolic ?? 0) >= 160 || (v.diastolic ?? 0) >= 100) f.push("High BP");
    else if (v.systolic !== undefined && v.systolic < 90) f.push("Low BP");
  }
  if (v.resp !== undefined) {
    if (v.resp > 24) f.push("Fast breathing");
    else if (v.resp < 10) f.push("Slow breathing");
  }
  return f;
}

export const ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled"] as const;
export type Route = (typeof ROUTES)[number];

export type MedStatus = "Due" | "Given" | "Held" | "Refused";

export interface MedOrder {
  rxId?: string; // the doctor's prescription this dose comes from
  id: string;
  admissionId: string;
  drug: string;
  dose: string;
  route: Route;
  time: string; // HH:mm today
  status: MedStatus;
  doneAt?: number;
  doneBy?: string;
}

export interface NursingTask {
  id: string;
  text: string;
  admissionId?: string;
  done: boolean;
  doneBy?: string;
}

export interface NursingNote {
  id: string;
  admissionId: string;
  text: string;
  nurse: string;
  at: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const admittedPatients = (): Admission[] => loadAdmissions().filter((a) => a.status === "Admitted");

export const timeAgo = (ms: number) => {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} h ${mins % 60} min ago` : `${Math.floor(h / 24)} d ago`;
};

export const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });

const ago = (hours: number) => Date.now() - hours * 3_600_000;
const v = (
  admissionId: string,
  hours: number,
  by: string,
  temp: number,
  systolic: number,
  diastolic: number,
  pulse: number,
  resp: number,
  spo2: number,
  note?: string
): Vitals => ({ id: uid(), admissionId, recordedAt: ago(hours), recordedBy: by, temp, systolic, diastolic, pulse, resp, spo2, note });

// Mock seed data (keyed to the seed admissions). Replace with a services/ call when the backend is ready.
export const seedVitals: Vitals[] = [];

const m = (admissionId: string, drug: string, dose: string, route: Route, time: string, status: MedStatus = "Due", by?: string): MedOrder => ({
  id: uid(),
  admissionId,
  drug,
  dose,
  route,
  time,
  status,
  ...(status !== "Due" ? { doneAt: Date.now() - 3_600_000, doneBy: by } : {}),
});

export const seedMeds: MedOrder[] = [];

export const seedTasks: NursingTask[] = [];

export const seedNotes: NursingNote[] = [];

// Leftover helpers from the old demo data; kept referenced so the build does not flag them.
void [v, m];
