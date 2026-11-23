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

// ---- Hospital patient register (browser localStorage) ----
// One shared register: every module picks patients from here, so a person must be registered before they are attended to.
// TODO: replace with services/ calls (GET/POST/PUT/DELETE /patients) once the backend is ready.
const KEY = "hms_patients";

export function loadPatients(): Patient[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(raw)) return raw as Patient[];
  } catch {
    /* ignore */
  }
  return seedPatients;
}

export function savePatients(list: Patient[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: changes last until refresh */
  }
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
