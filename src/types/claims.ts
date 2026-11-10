import { STORE_KEYS, loadStore, saveStore } from "../services/store";
import { balanceOf, type Invoice } from "./billing";
import type { Patient } from "./patients";

export const CLAIM_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Paid"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export interface ClaimLine {
  invoiceId: string;
  number: string; // invoice number
  patientId: string;
  patient: string;
  memberId?: string;
  amount: number; // invoice balance when the claim was made
}

export interface ClaimEvent {
  at: number;
  by: string;
  text: string;
}

/** A batch of invoices sent to one insurer, HMO or company for payment. */
export interface Claim {
  id: string;
  number: string; // CLM-1001
  payer: string; // insurer / HMO / company name
  payerType: string; // NHIA / NHIS, HMO, Corporate
  createdAt: number;
  createdBy: string;
  status: ClaimStatus;
  lines: ClaimLine[];
  submittedOn?: string; // YYYY-MM-DD
  reference?: string; // the payer's own claim reference
  approvedAmount?: number;
  receivedAmount: number;
  rejectionReason?: string;
  history: ClaimEvent[];
}

// TODO: replace with services/ calls (GET/POST/PUT /claims). Payments should be posted to invoices in the same transaction.
export const loadClaims = (): Claim[] => loadStore<Claim[]>(STORE_KEYS.claims, () => []);
export const saveClaims = (list: Claim[]) => saveStore(STORE_KEYS.claims, list);

export const claimTotal = (c: Claim) => Math.round(c.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;

/** What the payer still owes on this claim. */
export function claimOutstanding(c: Claim) {
  if (c.status === "Rejected" || c.status === "Paid") return 0;
  const target = c.status === "Approved" ? c.approvedAmount ?? 0 : claimTotal(c);
  return Math.max(0, Math.round((target - c.receivedAmount) * 100) / 100);
}

export function nextClaimNumber(list: Claim[]) {
  const max = list.reduce((m, c) => Math.max(m, parseInt(c.number.replace(/\D/g, ""), 10) || 0), 1000);
  return `CLM-${max + 1}`;
}

export const payerNameOf = (p: Patient) => p.payerName?.trim() || p.payer;

export interface Claimable {
  invoice: Invoice;
  patient: Patient;
  balance: number;
}

/** Unpaid invoices of patients covered by an insurer that are not already in a live claim, grouped by payer. */
export function claimableByPayer(invoices: Invoice[], patients: Patient[], claims: Claim[]) {
  const taken = new Set(claims.filter((c) => c.status !== "Rejected").flatMap((c) => c.lines.map((l) => l.invoiceId)));
  const groups = new Map<string, { type: string; rows: Claimable[] }>();
  for (const invoice of invoices) {
    const patient = patients.find((p) => p.id === invoice.patientId);
    const balance = balanceOf(invoice);
    if (!patient || patient.payer === "Self-pay" || balance <= 0 || taken.has(invoice.id)) continue;
    const key = payerNameOf(patient);
    const g = groups.get(key) ?? { type: patient.payer, rows: [] };
    g.rows.push({ invoice, patient, balance });
    groups.set(key, g);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}