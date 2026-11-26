import { addDaysISO, todayISO } from "./billing";

export const WARDS = [
  { name: "General Ward", prefix: "G", beds: 30, rateName: "General ward" },
  { name: "Maternity", prefix: "M", beds: 15, rateName: "Semi-private room" }, // adjust to your real maternity bed rate
  { name: "Pediatrics", prefix: "P", beds: 20, rateName: "Paediatric ward" },
  { name: "ICU", prefix: "I", beds: 8, rateName: "Intensive care unit (ICU)" },
] as const;

export type WardName = (typeof WARDS)[number]["name"];

export const WARD_NAMES = WARDS.map((w) => w.name) as WardName[];

export const DOCTORS = ["Dr. Eze", "Dr. Obi", "Dr. Ade", "Dr. Nwankwo"];

export const OUTCOMES = ["Recovered / improved", "Referred to another facility", "Discharged against medical advice", "Deceased"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface Admission {
  id: string;
  patientId: string; // registered patient (hms_patients)
  patient: string;
  ward: WardName;
  bed: string;
  admittedOn: string; // YYYY-MM-DD
  doctor: string;
  diagnosis: string;
  status: "Admitted" | "Discharged";
  dischargedOn?: string;
  outcome?: Outcome;
  dischargeNotes?: string;
}

export const wardInfo = (name: WardName) => WARDS.find((w) => w.name === name)!;

export const bedsOf = (ward: WardName): string[] => {
  const w = wardInfo(ward);
  return Array.from({ length: w.beds }, (_, i) => `${w.prefix}-${String(i + 1).padStart(2, "0")}`);
};

export function freeBeds(ward: WardName, admissions: Admission[]): string[] {
  const taken = new Set(admissions.filter((a) => a.status === "Admitted" && a.ward === ward).map((a) => a.bed));
  return bedsOf(ward).filter((b) => !taken.has(b));
}

/** Calendar days of stay, counted as at least 1. */
export function stayDays(a: Admission): number {
  const start = new Date(`${a.admittedOn}T00:00:00`).getTime();
  const end = new Date(`${a.dischargedOn ?? todayISO()}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export function nextAdmissionId(list: Admission[]) {
  const max = list.reduce((m, a) => Math.max(m, parseInt(a.id.replace(/\D/g, ""), 10) || 0), 300);
  return `AD-${max + 1}`;
}

const ago = (days: number) => addDaysISO(todayISO(), -days);

// Mock seed data. Replace with a services/ call when the backend is ready.
export const seedAdmissions: Admission[] = [];

/** Live data (survives reloads). Pages read this instead of the demo seed. */
export const loadAdmissions = (): any[] => []; // database only — use services/* => seedAdmissions);
