// The patient register as stored in the hospital database. Pages call these instead of reading the browser's storage.
import { useEffect, useState } from "react";
import { api, ApiError, onSessionCleared } from "./api";
import type { Patient } from "../types/patients";

/** What the registration form sends. The server adds the id (P-1001...), the registration date and merge history. */
export type PatientInput = Omit<Patient, "id" | "registeredOn" | "mergedFrom">;

/** A row of the list: the record plus whether the patient is on a ward now and the date of their last completed visit. */
export interface PatientListItem extends Patient {
  lastVisit: string | null;
  admitted: boolean;
}

export interface PatientFilters {
  search?: string;
  gender?: "Male" | "Female";
  payer?: string;
  hasAllergies?: boolean;
  limit?: number;
  offset?: number;
}

export interface PatientStats {
  total: number;
  newThisMonth: number;
  admitted: number;
  withAllergies: number;
}

/** What the chart shows about the rest of the hospital. A section is missing when the person may not view that module. */
export interface PatientSummary {
  appointments?: { id: string; date: string; doctor: string; status: string }[];
  admissions?: { id: string; ward: string | null; bed: string | null; status: string; admittedAt: string }[];
  labOrders?: { id: string; status: string; tests: { name: string }[] }[];
  invoices?: { id: string; number: string; status: string; balance: number }[];
  prescriptions?: { id: string; drug: string; status: string }[];
}

// ---- Patients this browser tab has loaded ----
// Pages that have not been moved to the database yet still need to look a patient up by id without waiting (see loadPatients in
// types/patients.ts). This remembers the patients the list, the picker and opened records have returned. It lives in
// sessionStorage, which the browser clears when the tab closes, and it is emptied when the person signs out or the session ends.
// It goes away once every page reads patients from the server.
const CACHE_KEY = "hms_patient_cache";
const CACHE_MAX = 500;

export function readPatientCache(): Patient[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as Patient[]) : [];
  } catch {
    return [];
  }
}

export function rememberPatients(list: Patient[]) {
  if (list.length === 0) return;
  try {
    const byId = new Map(readPatientCache().map((p) => [p.id, p] as const));
    for (const p of list) {
      byId.delete(p.id); // so the most recently seen patients are the last to be dropped
      byId.set(p.id, p);
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify([...byId.values()].slice(-CACHE_MAX)));
  } catch {
    /* storage blocked: lookups simply find nothing */
  }
}

export function forgetPatients() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
onSessionCleared(forgetPatients);

function queryString(f: PatientFilters) {
  const p = new URLSearchParams();
  if (f.search) p.set("search", f.search);
  if (f.gender) p.set("gender", f.gender);
  if (f.payer) p.set("payer", f.payer);
  if (f.hasAllergies) p.set("hasAllergies", "1");
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  if (f.offset !== undefined) p.set("offset", String(f.offset));
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function listPatients(f: PatientFilters = {}) {
  const r = await api.get<{ patients: PatientListItem[]; total: number }>(`/patients${queryString(f)}`);
  rememberPatients(r.patients);
  return r;
}

export const patientsApi = {
  list: listPatients,
  /** One patient by id WITHOUT opening their record (no audit entry): for background look-ups such as billing a completed visit. */
  findOne: async (id: string): Promise<Patient | undefined> => (await listPatients({ search: id, limit: 5 })).patients.find((p) => p.id === id),
  stats: () => api.get<PatientStats>("/patients/stats"),
  /** Opening a record is written to the audit log by the server. */
  get: async (id: string) => {
    const r = await api.get<{ patient: Patient }>(`/patients/${encodeURIComponent(id)}`);
    rememberPatients([r.patient]);
    return r;
  },
  summary: (id: string) => api.get<{ summary: PatientSummary }>(`/patients/${encodeURIComponent(id)}/summary`),
  /** When the server finds a likely duplicate it answers 409 with code "possible_duplicate"; send allowDuplicate to go ahead anyway. */
  create: async (data: PatientInput, allowDuplicate = false) => {
    const r = await api.post<{ patient: Patient }>("/patients", { ...data, allowDuplicate });
    rememberPatients([r.patient]);
    return r;
  },
  update: async (id: string, data: PatientInput, allowDuplicate = false) => {
    const r = await api.put<{ patient: Patient }>(`/patients/${encodeURIComponent(id)}`, { ...data, allowDuplicate });
    rememberPatients([r.patient]);
    return r;
  },
  remove: (id: string) => api.del(`/patients/${encodeURIComponent(id)}`),
};

/**
 * One patient by id, fetched from the database (and remembered for pages that still look patients up with loadPatients()).
 * Opening a record is written to the audit log by the server, so use this where a person is actually opening the patient.
 */
export function usePatient(id: string | undefined): { patient: Patient | null; loading: boolean; error: string } {
  const [state, setState] = useState<{ patient: Patient | null; loading: boolean; error: string }>({ patient: null, loading: !!id, error: "" });
  useEffect(() => {
    if (!id) {
      setState({ patient: null, loading: false, error: "" });
      return;
    }
    let stale = false;
    setState({ patient: null, loading: true, error: "" });
    patientsApi
      .get(id)
      .then((r) => !stale && setState({ patient: r.patient, loading: false, error: "" }))
      .catch((e) => !stale && setState({ patient: null, loading: false, error: e instanceof ApiError ? e.message : "Couldn't reach the server." }));
    return () => {
      stale = true;
    };
  }, [id]);
  return state;
}