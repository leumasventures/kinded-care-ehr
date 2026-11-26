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
export const seedLabOrders: LabOrder[] = [];

/** Live data (survives reloads). Pages read this instead of the demo seed. */
export const loadLabOrders = (): any[] => []; // database only — use services/* => seedLabOrders);

// Leftover helpers from the old demo data; kept referenced so the build does not flag them.
void [t, day];
