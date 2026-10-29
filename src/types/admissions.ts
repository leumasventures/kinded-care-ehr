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
export const seedAdmissions: Admission[] = [
  { id: "AD-301", patient: "Ifeanyi Uche", ward: "General Ward", bed: "G-11", admittedOn: ago(3), doctor: "Dr. Eze", diagnosis: "Typhoid fever", status: "Admitted" },
  { id: "AD-302", patient: "Amaka Nwosu", ward: "Maternity", bed: "M-02", admittedOn: ago(2), doctor: "Dr. Obi", diagnosis: "Post-delivery care", status: "Admitted" },
  { id: "AD-303", patient: "Emeka Obi", ward: "ICU", bed: "I-03", admittedOn: ago(1), doctor: "Dr. Ade", diagnosis: "Severe pneumonia", status: "Admitted" },
  { id: "AD-304", patient: "Ngozi Eke", ward: "General Ward", bed: "G-04", admittedOn: ago(5), doctor: "Dr. Eze", diagnosis: "Uncontrolled hypertension", status: "Admitted" },
  { id: "AD-305", patient: "Chinedu Okoro", ward: "General Ward", bed: "G-07", admittedOn: ago(2), doctor: "Dr. Nwankwo", diagnosis: "Acute gastroenteritis", status: "Admitted" },
  { id: "AD-306", patient: "Blessing Nnadi", ward: "Maternity", bed: "M-05", admittedOn: ago(1), doctor: "Dr. Obi", diagnosis: "Pre-eclampsia", status: "Admitted" },
  { id: "AD-307", patient: "Baby Adaeze Eze", ward: "Pediatrics", bed: "P-03", admittedOn: ago(4), doctor: "Dr. Ade", diagnosis: "Severe malaria", status: "Admitted" },
  { id: "AD-308", patient: "Master Kelechi Obi", ward: "Pediatrics", bed: "P-08", admittedOn: ago(2), doctor: "Dr. Ade", diagnosis: "Bronchiolitis", status: "Admitted" },
  { id: "AD-309", patient: "Uche Anyanwu", ward: "ICU", bed: "I-01", admittedOn: ago(6), doctor: "Dr. Nwankwo", diagnosis: "Post-operative monitoring", status: "Admitted" },
  { id: "AD-290", patient: "Ada Ibe", ward: "General Ward", bed: "G-02", admittedOn: ago(9), doctor: "Dr. Eze", diagnosis: "Cellulitis", status: "Discharged", dischargedOn: ago(4), outcome: "Recovered / improved" },
  { id: "AD-291", patient: "Obinna Eze", ward: "General Ward", bed: "G-09", admittedOn: ago(8), doctor: "Dr. Nwankwo", diagnosis: "Appendicitis (post-op)", status: "Discharged", dischargedOn: ago(3), outcome: "Recovered / improved" },
  { id: "AD-292", patient: "Mary Nwafor", ward: "Maternity", bed: "M-01", admittedOn: ago(6), doctor: "Dr. Obi", diagnosis: "Caesarean section", status: "Discharged", dischargedOn: ago(2), outcome: "Recovered / improved" },
];