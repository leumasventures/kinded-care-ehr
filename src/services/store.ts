// Operational data lives in the hospital database only.
import { useState, type Dispatch, type SetStateAction } from "react";

export function loadStore<T>(_key: string, seed: () => T): T {
  return seed();
}

export function saveStore<T>(_key: string, _value: T) {
  /* no-op */
}

export function usePersisted<T>(_key: string, seed: () => T): [T, Dispatch<SetStateAction<T>>] {
  return useState<T>(seed);
}

export const STORE_KEYS = {
  appointments: "hms_appointments",
  admissions: "hms_admissions",
  labOrders: "hms_lab_orders",
  dispensing: "hms_dispensing",
  drugs: "hms_drugs",
  invoices: "hms_invoices",
  claims: "hms_claims",
  doctors: "hms_doctors",
  roster: "hms_roster",
  settings: "hms_settings",
  accounts: "hms_accounts",
  priceList: "hms_price_list",
  patients: "hms_patients",
  suppliers: "hms_suppliers",
  stockReceipts: "hms_stock_receipts",
  documents: "hms_documents",
  triage: "hms_triage",
  patientMerges: "hms_patient_merges",
} as const;
