import { readPatientCache, rememberPatients } from "../services/patients";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] as const;
export const GENOTYPES = ["AA", "AS", "SS", "AC", "SC", "Unknown"] as const;
export const PAYERS = ["Self-pay", "NHIA / NHIS", "HMO", "Corporate"] as const;
export const RELATIONSHIPS = ["Spouse", "Parent", "Child", "Sibling", "Guardian", "Friend", "Other"] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number];
export type Genotype = (typeof GENOTYPES)[number];
export type Payer = (typeof PAYERS)[number];

export interface Patient {
  id: string;
  name: string;
  dob: string; // YYYY-MM-DD
  gender: "Male" | "Female";
  phone: string;
  address: string;
  bloodGroup: BloodGroup;
  genotype: Genotype;
  payer: Payer;
  allergies: string; // comma separated, empty = none known
  kinName: string;
  kinRelation: string;
  kinPhone: string;
  notes?: string;
  /** Insurer or HMO name and the patient's enrolment / member number (for claims). */
  payerName?: string;
  memberId?: string;
  /** Ids of duplicate registrations that were merged into this one. */
  mergedFrom?: string[];
  registeredOn: string; // YYYY-MM-DD
}

export function ageLabel(dob: string) {
  const b = new Date(`${dob}T00:00:00`);
  const n = new Date();
  let months = (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth());
  if (n.getDate() < b.getDate()) months--;
  months = Math.max(months, 0);
  return months < 24 ? `${months} mo` : `${Math.floor(months / 12)} yrs`;
}

export const allergyList = (p: Patient) =>
  p.allergies
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

export function nextPatientId(list: Patient[]) {
  const max = list.reduce((m, p) => Math.max(m, parseInt(p.id.replace(/\D/g, ""), 10) || 0), 1000);
  return `P-${max + 1}`;
}

const p = (
  id: number,
  name: string,
  dob: string,
  gender: "Male" | "Female",
  phone: string,
  address: string,
  bloodGroup: BloodGroup,
  genotype: Genotype,
  payer: Payer,
  allergies: string,
  kin: [string, string, string],
  registeredOn: string
): Patient => ({
  id: `P-${id}`,
  name,
  dob,
  gender,
  phone,
  address,
  bloodGroup,
  genotype,
  payer,
  allergies,
  kinName: kin[0],
  kinRelation: kin[1],
  kinPhone: kin[2],
  registeredOn,
});

// Mock seed data. Replace with a services/ call when the backend is ready.
export const seedPatients: Patient[] = [];

// ---- Patients this tab has loaded from the database ----
// The register itself now lives in the hospital database (services/patients.ts). Pages that have not been moved over yet still
// call loadPatients() to look someone up by id without waiting, so it returns the patients this browser tab has loaded from the
// server (the patient list, the patient picker, an opened record). It is cleared when the tab closes or the person signs out.
// A patient this tab has not loaded is not found, so those pages must be moved to services/patients.ts (usePatient / patientsApi).
export const loadPatients: () => Patient[] = readPatientCache;

/** Kept so the old merge code still compiles; it only adds to the tab's remembered patients. Nothing is saved in the browser. */
export function savePatients(list: Patient[]) {
  rememberPatients(list);
}

/** Finds likely duplicates before a new patient is registered (same phone, or same name and date of birth). */
export function findDuplicates(list: Patient[], draft: Pick<Patient, "name" | "dob" | "phone">, ignoreId?: string) {
  const digits = (s: string) => s.replace(/\D/g, "");
  const name = draft.name.trim().toLowerCase();
  return list.filter(
    (p) =>
      p.id !== ignoreId &&
      ((digits(draft.phone).length >= 10 && digits(p.phone) === digits(draft.phone)) || (p.name.trim().toLowerCase() === name && p.dob === draft.dob))
  );
}

// Leftover helper from the old demo data; kept referenced so the build does not flag it.
void p;