import { seedAdmissions, type Admission } from "./admissions";

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

export const admittedPatients = (): Admission[] => seedAdmissions.filter((a) => a.status === "Admitted");

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
export const seedVitals: Vitals[] = [
  v("AD-301", 2, "Nurse Chioma", 38.2, 135, 90, 96, 20, 95, "Febrile; paracetamol given"),
  v("AD-301", 9, "Nurse Chioma", 38.9, 130, 85, 102, 22, 96),
  v("AD-302", 1.5, "Nurse Chioma", 37.4, 110, 70, 88, 18, 99),
  v("AD-303", 0.5, "Nurse Ngozi", 37.9, 118, 76, 112, 28, 91, "On oxygen 4 L/min"),
  v("AD-304", 3, "Nurse Ngozi", 36.8, 168, 102, 84, 18, 98, "Headache; doctor informed"),
  v("AD-305", 9, "Nurse Chioma", 37.1, 120, 80, 78, 16, 98),
  v("AD-306", 1, "Nurse Chioma", 36.9, 152, 98, 90, 18, 98),
  v("AD-307", 2.5, "Nurse Ngozi", 38.4, 90, 60, 128, 32, 96),
  v("AD-308", 4, "Nurse Ngozi", 37.2, 100, 64, 104, 24, 97),
  v("AD-309", 1, "Nurse Ngozi", 36.6, 124, 78, 72, 14, 98),
];

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

export const seedMeds: MedOrder[] = [
  m("AD-301", "Ceftriaxone", "1 g", "IV", "08:00", "Given", "Nurse Chioma"),
  m("AD-301", "Paracetamol", "1 g", "Oral", "12:00"),
  m("AD-301", "Ceftriaxone", "1 g", "IV", "20:00"),
  m("AD-302", "Ferrous sulphate", "200 mg", "Oral", "09:00", "Given", "Nurse Chioma"),
  m("AD-302", "Paracetamol", "1 g", "Oral", "15:00"),
  m("AD-303", "Ceftriaxone", "2 g", "IV", "06:00", "Given", "Nurse Ngozi"),
  m("AD-303", "Ceftriaxone", "2 g", "IV", "18:00"),
  m("AD-303", "Salbutamol", "2 puffs", "Inhaled", "10:00", "Given", "Nurse Ngozi"),
  m("AD-304", "Amlodipine", "10 mg", "Oral", "08:00", "Given", "Nurse Ngozi"),
  m("AD-304", "Amlodipine", "10 mg", "Oral", "20:00"),
  m("AD-305", "ORS", "200 ml", "Oral", "11:00", "Held", "Nurse Chioma"),
  m("AD-305", "Metronidazole", "400 mg", "Oral", "14:00"),
  m("AD-306", "Methyldopa", "250 mg", "Oral", "08:00", "Given", "Nurse Chioma"),
  m("AD-306", "Methyldopa", "250 mg", "Oral", "16:00"),
  m("AD-307", "Artesunate", "60 mg", "IV", "07:00", "Given", "Nurse Ngozi"),
  m("AD-307", "Paracetamol", "120 mg", "Oral", "13:00"),
  m("AD-308", "Salbutamol", "2 puffs", "Inhaled", "09:00", "Given", "Nurse Ngozi"),
  m("AD-309", "Gentamicin", "80 mg", "IV", "10:00", "Given", "Nurse Ngozi"),
  m("AD-309", "Gentamicin", "80 mg", "IV", "22:00"),
];

export const seedTasks: NursingTask[] = [
  { id: uid(), text: "Change dressing", admissionId: "AD-301", done: false },
  { id: uid(), text: "Monitor blood pressure hourly; inform doctor if above 160/100", admissionId: "AD-306", done: false },
  { id: uid(), text: "Fluid balance chart", admissionId: "AD-303", done: false },
  { id: uid(), text: "Check oxygen cylinder levels (ICU)", done: true, doneBy: "Nurse Ngozi" },
  { id: uid(), text: "Restock ward emergency trolley", done: false },
  { id: uid(), text: "Shift handover notes", done: false },
];

export const seedNotes: NursingNote[] = [
  { id: uid(), admissionId: "AD-304", text: "Complains of headache. BP 168/102. Dr. Eze informed, review requested.", nurse: "Nurse Ngozi", at: ago(3) },
  { id: uid(), admissionId: "AD-301", text: "Febrile overnight, tepid sponging done. Taking oral fluids well.", nurse: "Nurse Chioma", at: ago(9) },
];