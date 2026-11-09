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

const rows: [string, DrugCategory, number, number, number][] = [
  // name (must match the Price List), category, stock, reorder level, expiry (days from today)
  ["Paracetamol 500mg tablets", "Analgesic", 480, 100, 400],
  ["Ibuprofen 400mg tablets", "Analgesic", 120, 60, 300],
  ["Diclofenac 50mg tablets", "Analgesic", 75, 60, 25],
  ["Amoxicillin 500mg capsules", "Antibiotic", 60, 80, 250],
  ["Amoxicillin/Clavulanate 625mg", "Antibiotic", 45, 30, 200],
  ["Ciprofloxacin 500mg tablets", "Antibiotic", 90, 50, 330],
  ["Metronidazole 400mg tablets", "Antibiotic", 200, 80, 380],
  ["Azithromycin 500mg tablets", "Antibiotic", 30, 20, 150],
  ["Artemether/Lumefantrine (antimalarial)", "Antimalarial", 210, 100, 420],
  ["Artesunate injection", "Antimalarial", 18, 20, 180],
  ["Metformin 500mg tablets", "Antidiabetic", 35, 60, 300],
  ["Amlodipine 5mg tablets", "Antihypertensive", 140, 60, 500],
  ["Lisinopril 10mg tablets", "Antihypertensive", 85, 40, 450],
  ["Omeprazole 20mg capsules", "Gastrointestinal", 110, 50, 260],
  ["Oral rehydration salts (ORS)", "Rehydration", 150, 50, 600],
  ["Vitamin C 500mg tablets", "Vitamins & supplements", 200, 60, 700],
  ["Ferrous sulphate tablets", "Vitamins & supplements", 90, 40, 280],
  ["Folic acid 5mg tablets", "Vitamins & supplements", 0, 40, 320],
  ["Cetirizine 10mg tablets", "Antihistamine", 70, 30, -10],
  ["Salbutamol inhaler", "Respiratory", 14, 10, 360],
  ["Normal saline 0.9% (500ml)", "IV fluids", 60, 40, 500],
  ["Dextrose 5% (500ml)", "IV fluids", 25, 30, 480],
  ["Ringer's lactate (500ml)", "IV fluids", 48, 30, 430],
  ["Ceftriaxone 1g injection", "Injectables", 55, 30, 300],
  ["Gentamicin injection", "Injectables", 80, 40, 260],
  ["Hydrocortisone injection", "Injectables", 22, 15, 75],
  ["Diazepam 10mg injection", "Injectables", 12, 10, 200],
  ["Tetanus toxoid injection", "Vaccines", 35, 20, 240],
  ["Syringe & needle", "Consumables", 500, 200, 900],
];

// Mock seed data. Replace with a services/ call when the backend is ready.
export const seedDrugs: Drug[] = rows.map(([name, category, stock, reorderAt, exp], i) => ({
  sku: `D-${String(i + 1).padStart(3, "0")}`,
  name,
  category,
  unit: unitOf(name),
  stock,
  reorderAt,
  price: priceOf(name),
  expiry: day(exp),
}));

export const seedDispensing: Dispensing[] = [
  {
    id: "RX-1001", date: day(0), patientId: "P-1001", patient: "Chidi Okafor", prescriber: "Dr. Eze",
    lines: [
      { sku: "D-001", name: "Paracetamol 500mg tablets", qty: 2, unitPrice: priceOf("Paracetamol 500mg tablets") },
      { sku: "D-009", name: "Artemether/Lumefantrine (antimalarial)", qty: 1, unitPrice: priceOf("Artemether/Lumefantrine (antimalarial)") },
    ],
    total: 2 * priceOf("Paracetamol 500mg tablets") + priceOf("Artemether/Lumefantrine (antimalarial)"),
  },
  {
    id: "RX-1002", date: day(-1), patientId: "P-1004", patient: "Ngozi Eke", prescriber: "Dr. Ade",
    lines: [{ sku: "D-015", name: "Oral rehydration salts (ORS)", qty: 4, unitPrice: priceOf("Oral rehydration salts (ORS)") }],
    total: 4 * priceOf("Oral rehydration salts (ORS)"),
  },
];