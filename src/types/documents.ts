import { STORE_KEYS, loadStore, saveStore } from "../services/store";
import { addDaysISO } from "./billing";

export const DOC_TYPES = ["Sick note", "Referral letter", "Prescription", "Discharge summary"] as const;
export type DocType = (typeof DOC_TYPES)[number];

const PREFIX: Record<DocType, string> = { "Sick note": "SN", "Referral letter": "RF", Prescription: "RX", "Discharge summary": "DS" };

export interface MedLine {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}

/** The fields each document type fills in. Everything is optional because each type uses its own subset. */
export interface DocData {
  allergies?: string;
  meds?: MedLine[];
  diagnosis?: string;
  remarks?: string;
  // Sick note
  from?: string;
  to?: string;
  showDiagnosis?: boolean;
  // Referral letter
  recipient?: string;
  facility?: string;
  specialty?: string;
  urgency?: string;
  reason?: string;
  summary?: string;
  investigations?: string;
  // Discharge summary
  admissionId?: string;
  ward?: string;
  admittedOn?: string;
  dischargedOn?: string;
  outcome?: string;
  course?: string;
  followUp?: string;
  followUpDate?: string;
}

/** An issued document is a record: it is never edited or deleted. A correction is a new document. */
export interface IssuedDoc {
  id: string;
  number: string; // e.g. SN-1001
  type: DocType;
  patientId: string;
  patientName: string;
  issuedAt: number;
  issuedBy: string;
  issuedRole: string;
  data: DocData;
}

// TODO: replace with services/ calls (GET/POST /patients/:id/documents). The backend should assign the number.
export const loadDocuments = (): IssuedDoc[] => loadStore<IssuedDoc[]>(STORE_KEYS.documents, () => []);
export const saveDocuments = (list: IssuedDoc[]) => saveStore(STORE_KEYS.documents, list);

export function nextDocNumber(list: IssuedDoc[], type: DocType) {
  const max = list
    .filter((d) => d.type === type)
    .reduce((m, d) => Math.max(m, parseInt(d.number.replace(/\D/g, ""), 10) || 0), 1000);
  return `${PREFIX[type]}-${max + 1}`;
}

/** Number of calendar days from `from` to `to`, counting both. */
export function daysBetween(from: string, to: string) {
  if (!from || !to || to < from) return 0;
  let n = 1;
  for (let d = from; d < to && n < 400; d = addDaysISO(d, 1)) n++;
  return n;
}