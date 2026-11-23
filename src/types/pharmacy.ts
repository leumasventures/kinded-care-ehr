import { STORE_KEYS, loadStore } from "../services/store";
import { addDaysISO, todayISO } from "./billing";
import { defaultPriceList } from "./pricing";

export const DRUG_CATEGORIES = [
  "Analgesic",
  "Antibiotic",
  "Antimalarial",
  "Antidiabetic",
  "Antihypertensive",
  "Gastrointestinal",
  "Antihistamine",
  "Respiratory",
  "Rehydration",
  "Vitamins & supplements",
  "IV fluids",
  "Injectables",
  "Vaccines",
  "Consumables",
] as const;

export type DrugCategory = (typeof DRUG_CATEGORIES)[number];

export interface Drug {
  sku: string;
  name: string; // matching a Price List name makes the Price List price apply
  category: DrugCategory;
  unit: string; // e.g. "strip", "vial"
  stock: number;
  reorderAt: number;
  price: number; // fallback ₦ price if the name isn't in the Price List
  expiry: string; // earliest-expiring batch, YYYY-MM-DD
}

export interface DispenseLine {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface Dispensing {
  id: string;
  date: string;
  patientId: string; // registered patient (hms_patients)
  patient: string;
  prescriber: string;
  rxIds?: string[]; // prescriptions from the chart that this dispensing fulfilled
  lines: DispenseLine[];
  total: number;
}

export const EXPIRY_WARNING_DAYS = 90;

export const isLow = (d: Drug) => d.stock > 0 && d.stock <= d.reorderAt;
export const isOut = (d: Drug) => d.stock <= 0;
export const isExpired = (d: Drug) => d.expiry < todayISO();
export const isExpiringSoon = (d: Drug) => !isExpired(d) && d.expiry <= addDaysISO(todayISO(), EXPIRY_WARNING_DAYS);

export function nextSku(list: Drug[]) {
  const max = list.reduce((m, d) => Math.max(m, parseInt(d.sku.replace(/\D/g, ""), 10) || 0), 0);
  return `D-${String(max + 1).padStart(3, "0")}`;
}

export function nextRxId(list: Dispensing[]) {
  const max = list.reduce((m, d) => Math.max(m, parseInt(d.id.replace(/\D/g, ""), 10) || 0), 1000);
  return `RX-${max + 1}`;
}

const day = (offset: number) => addDaysISO(todayISO(), offset);
const unitOf = (name: string) => (defaultPriceList.find((p) => p.name === name)?.unit ?? "per unit").replace(/^per /, "");
const priceOf = (name: string) => defaultPriceList.find((p) => p.name === name)?.price ?? 0;

const rows: [string, DrugCategory, number, number, number][] = [];

// Mock seed data. Replace with a services/ call when the backend is ready.
export const seedDrugs: Drug[] = [];

export const seedDispensing: Dispensing[] = [];

/** Live data (survives reloads). Pages read this instead of the demo seed. */
export const loadDispensing = (): Dispensing[] => loadStore(STORE_KEYS.dispensing, () => seedDispensing);
export const loadDrugs = (): Drug[] => loadStore(STORE_KEYS.drugs, () => seedDrugs);
