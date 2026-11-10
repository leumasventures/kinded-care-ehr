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
export const seedPatients: Patient[] = [
  p(1001, "Chidi Okafor", "1992-03-14", "Male", "0803 555 0101", "12 Ngwa Road, Aba", "O+", "AA", "Self-pay", "Penicillin", ["Ada Okafor", "Spouse", "0803 555 0901"], "2026-01-12"),
  p(1002, "Amaka Nwosu", "1998-07-02", "Female", "0802 555 0102", "5 Faulks Road, Aba", "A+", "AS", "HMO", "", ["Peter Nwosu", "Spouse", "0802 555 0902"], "2026-03-04"),
  p(1003, "Ifeanyi Uche", "1981-05-20", "Male", "0805 555 0103", "21 Asa Road, Aba", "B+", "AA", "Corporate", "", ["Grace Uche", "Spouse", "0805 555 0903"], "2025-11-18"),
  p(1004, "Ngozi Eke", "1974-11-30", "Female", "0807 555 0104", "8 Park Road, Aba", "O+", "AA", "NHIA / NHIS", "Sulfa drugs", ["Chuka Eke", "Child", "0807 555 0904"], "2025-06-21"),
  p(1005, "Emeka Obi", "2007-02-09", "Male", "0809 555 0105", "3 Ukwa Street, Aba", "A-", "AS", "Self-pay", "", ["Mrs Obi", "Parent", "0809 555 0905"], "2026-10-27"),
  p(1006, "Blessing Nnadi", "1995-09-17", "Female", "0809 555 0106", "17 Azikiwe Road, Aba", "B+", "AA", "HMO", "", ["Tony Nnadi", "Spouse", "0809 555 0906"], "2026-08-02"),
  p(1007, "Chinedu Okoro", "1988-01-25", "Male", "0803 555 0107", "44 Jubilee Road, Aba", "O+", "AA", "Self-pay", "", ["Ifeoma Okoro", "Sibling", "0803 555 0907"], "2026-05-30"),
  p(1008, "Baby Adaeze Eze", "2026-01-18", "Female", "0805 555 0108", "9 Eziukwu Road, Aba", "A+", "AS", "Self-pay", "", ["Mrs Eze", "Parent", "0805 555 0908"], "2026-01-18"),
  p(1009, "Master Kelechi Obi", "2021-06-10", "Male", "0802 555 0109", "3 Ukwa Street, Aba", "A+", "AA", "Self-pay", "Eggs", ["Mrs Obi", "Parent", "0809 555 0905"], "2024-04-11"),
  p(1010, "Uche Anyanwu", "1969-12-03", "Male", "0807 555 0110", "2 Hospital Road, Aba", "AB+", "AA", "Corporate", "Aspirin", ["Chidi Anyanwu", "Child", "0807 555 0910"], "2025-09-09"),
  p(1011, "Ada Ibe", "1990-04-22", "Female", "0803 555 0111", "60 Brass Junction, Aba", "O-", "AA", "Self-pay", "", ["Obi Ibe", "Sibling", "0803 555 0911"], "2026-09-30"),
  p(1012, "Obinna Eze", "1985-08-08", "Male", "0805 555 0112", "14 Omuma Road, Aba", "B-", "AS", "HMO", "", ["Nneka Eze", "Spouse", "0805 555 0912"], "2026-02-14"),
  p(1013, "Mary Nwafor", "1993-10-12", "Female", "0802 555 0113", "7 Umuola Road, Aba", "A+", "AA", "Self-pay", "", ["John Nwafor", "Spouse", "0802 555 0913"], "2026-06-06"),
  p(1014, "Ijeoma Ude", "2000-02-28", "Female", "0805 555 0114", "30 St Michael's Road, Aba", "O+", "AC", "Self-pay", "", ["Mr Ude", "Parent", "0805 555 0914"], "2026-07-19"),
  p(1015, "Samuel Agu", "1978-06-15", "Male", "0809 555 0115", "11 Cemetery Road, Aba", "O+", "AA", "Corporate", "", ["Rita Agu", "Spouse", "0809 555 0915"], "2025-12-01"),
];

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