// Browser-localStorage "mock backend" shared by every module.
// TODO: replace loadStore/saveStore with services/ calls (GET/PUT per resource) once the backend is ready.
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export function loadStore<T>(key: string, seed: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(seed()) ? Array.isArray(parsed) : parsed && typeof parsed === "object") return parsed as T;
    }
  } catch {
    /* corrupt or unavailable: fall back to the seed */
  }
  return seed();
}

export function saveStore<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: changes last until refresh */
  }
}

/** useState that keeps its value in localStorage, so the page's data survives a reload and other pages can read it. */
export function usePersisted<T>(key: string, seed: () => T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => loadStore(key, seed));
  useEffect(() => saveStore(key, value), [key, value]);
  return [value, setValue];
}

/** Keys that hold operational data (everything except sign-in state). Used by backup and restore. */
export const STORE_KEYS = {
  appointments: "hms_appointments",
  admissions: "hms_admissions",
  labOrders: "hms_lab_orders",
  dispensing: "hms_dispensing",
  drugs: "hms_drugs",
  invoices: "hms_invoices",
  triage: "hms_triage",
  doctors: "hms_doctors",
  documents: "hms_documents",
} as const;