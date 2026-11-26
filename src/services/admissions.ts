import { api } from "./api";

export interface Admission {
  id: string;
  patientId: string;
  patientName: string | null;
  doctorId: string | null;
  doctor: string | null;
  ward: string | null;
  bed: string | null;
  status: string;
  admittedAt: string;
  dischargedAt?: string | null;
  reason?: string | null;
  outcome?: string | null;
  dischargeSummary?: string | null;
}

export interface AdmissionInput {
  patientId: string;
  doctorId?: string;
  ward?: string;
  bed?: string;
  reason?: string;
}

export interface AdmissionUpdate {
  doctorId?: string;
  ward?: string;
  bed?: string;
  reason?: string;
}

export interface DischargeInput {
  outcome?: string;
  dischargeSummary?: string;
}

export interface WardCensus {
  ward: string;
  occupied: number;
}

export interface AdmissionFilters {
  status?: string;
  ward?: string;
  doctorId?: string;
  patientId?: string;
  limit?: number;
}

function qs(f: AdmissionFilters) {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.ward) p.set("ward", f.ward);
  if (f.doctorId) p.set("doctorId", f.doctorId);
  if (f.patientId) p.set("patientId", f.patientId);
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const admissionsApi = {
  list: async (f: AdmissionFilters = {}) =>
    (await api.get<{ admissions: Admission[] }>(`/admissions${qs(f)}`)).admissions,
  census: async () => (await api.get<{ wards: WardCensus[] }>("/admissions/census")).wards,
  get: async (id: string) => (await api.get<{ admission: Admission }>(`/admissions/${id}`)).admission,
  create: (data: AdmissionInput) => api.post<{ admission: Admission }>("/admissions", data),
  update: (id: string, data: AdmissionUpdate) =>
    api.put<{ admission: Admission }>(`/admissions/${id}`, data),
  discharge: (id: string, data: DischargeInput = {}) =>
    api.post<{ admission: Admission }>(`/admissions/${id}/discharge`, data),
};
