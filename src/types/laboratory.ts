import { STORE_KEYS, loadStore } from "../services/store";
import { addDaysISO, todayISO } from "./billing";
import { defaultPriceList } from "./pricing";

export const LAB_STATUSES = ["Pending", "Sample collected", "Processing", "Ready", "Cancelled"] as const;
export type LabStatus = (typeof LAB_STATUSES)[number];

export type Priority = "Routine" | "Urgent";

export const FLAGS = ["Normal", "High", "Low", "Abnormal", "Critical"] as const;
export type Flag = (typeof FLAGS)[number];

export interface LabTest {
  id: string;
  name: string;
  price: number; // ₦ at the time of ordering
  result?: string;
  unit?: string;
  range?: string; // reference range as used by your lab
  flag?: Flag;
}

export interface LabOrder {
  id: string;
  patientId: string; // registered patient (hms_patients)
  patient: string;
  requestedBy: string;
  date: string; // YYYY-MM-DD
  priority: Priority;
  status: LabStatus;
  tests: LabTest[];
  clinicalNote?: string;
  reportedOn?: string;
  appointmentId?: string; // set when the doctor ordered it from a consultation
}

export const orderTotal = (o: LabOrder) => o.tests.reduce((s, t) => s + t.price, 0);

export function nextLabId(list: LabOrder[]) {
  const max = list.reduce((m, o) => Math.max(m, parseInt(o.id.replace(/\D/g, ""), 10) || 0), 500);
  return `L-${max + 1}`;
}

const testId = () => Math.random().toString(36).slice(2, 10);
const priceOf = (name: string) => defaultPriceList.find((p) => p.name === name)?.price ?? 0;
const t = (name: string, extra: Partial<LabTest> = {}): LabTest => ({ id: testId(), name, price: priceOf(name), ...extra });
const day = (offset: number) => addDaysISO(todayISO(), offset);

// Mock seed data (dates relative to today). Replace with a services/ call when the backend is ready.
export const seedLabOrders: LabOrder[] = [
  {
    id: "L-501", patientId: "P-1001", patient: "Chidi Okafor", requestedBy: "Dr. Eze", date: day(0), priority: "Routine", status: "Ready", reportedOn: day(0),
    tests: [
      t("Full blood count (FBC)", { result: "Hb 13.2; WBC 6.1; Platelets 250", unit: "g/dL; ×10⁹/L; ×10⁹/L", range: "See analyser ranges", flag: "Normal" }),
      t("Malaria parasite (MP)", { result: "Negative", flag: "Normal" }),
    ],
  },
  { id: "L-502", patientId: "P-1002", patient: "Amaka Nwosu", requestedBy: "Dr. Obi", date: day(0), priority: "Urgent", status: "Processing", clinicalNote: "Pre-eclampsia work-up", tests: [t("Liver function test (LFT)"), t("Kidney function test (E/U/Cr)")] },
  { id: "L-503", patientId: "P-1003", patient: "Ifeanyi Uche", requestedBy: "Dr. Eze", date: day(0), priority: "Routine", status: "Pending", tests: [t("Fasting blood sugar")] },
  { id: "L-504", patientId: "P-1004", patient: "Ngozi Eke", requestedBy: "Dr. Ade", date: day(-1), priority: "Routine", status: "Ready", reportedOn: day(-1), tests: [t("Urinalysis", { result: "Protein trace; glucose negative", flag: "Abnormal" })] },
  { id: "L-505", patientId: "P-1005", patient: "Emeka Obi", requestedBy: "Dr. Ade", date: day(0), priority: "Urgent", status: "Sample collected", clinicalNote: "Severe pneumonia, ICU", tests: [t("Blood culture & sensitivity"), t("Full blood count (FBC)")] },
  { id: "L-506", patientId: "P-1008", patient: "Baby Adaeze Eze", requestedBy: "Dr. Ade", date: day(-1), priority: "Urgent", status: "Processing", tests: [t("Malaria parasite (MP)"), t("Packed cell volume (PCV)")] },
  { id: "L-507", patientId: "P-1013", patient: "Mary Nwafor", requestedBy: "Dr. Obi", date: day(-2), priority: "Routine", status: "Cancelled", tests: [t("Lipid profile")] },
];

/** Live data (survives reloads). Pages read this instead of the demo seed. */
export const loadLabOrders = (): LabOrder[] => loadStore(STORE_KEYS.labOrders, () => seedLabOrders);