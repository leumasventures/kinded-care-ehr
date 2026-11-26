import { api } from "./api";

export interface Vitals {
  id: string;
  patientId: string;
  patient?: string;
  admissionId?: string | null;
  tempC?: number | null;
  pulse?: number | null;
  respRate?: number | null;
  bpSys?: number | null;
  bpDia?: number | null;
  spo2?: number | null;
  weightKg?: number | null;
  notes?: string | null;
  recordedBy?: string | null;
  recordedAt: string;
  alerts?: string[];
}

export interface NursingNote {
  id: string;
  patientId: string;
  patient?: string;
  note: string;
  recordedBy?: string | null;
  recordedAt: string;
  [key: string]: unknown;
}

export interface WardBoardRow {
  admissionId: string;
  patientId: string;
  patientName: string;
  ward: string | null;
  bed: string | null;
  vitals?: Partial<Vitals> | null;
  [key: string]: unknown;
}

export interface VitalsInput {
  patientId: string;
  tempC?: number;
  pulse?: number;
  respRate?: number;
  bpSys?: number;
  bpDia?: number;
  spo2?: number;
  weightKg?: number;
  notes?: string;
}

export interface NoteInput {
  patientId: string;
  note: string;
}

export const nursingApi = {
  vitals: async (patientId: string, limit?: number) => {
    const q = new URLSearchParams({ patientId });
    if (limit !== undefined) q.set("limit", String(limit));
    return (await api.get<{ vitals: Vitals[] }>(`/nursing/vitals?${q}`)).vitals;
  },
  recordVitals: (data: VitalsInput) => api.post<{ vitals: Vitals }>("/nursing/vitals", data),
  board: async (ward?: string) => {
    const q = ward ? `?ward=${encodeURIComponent(ward)}` : "";
    return (await api.get<{ board: WardBoardRow[] }>(`/nursing/board${q}`)).board;
  },
  notes: async (patientId: string) =>
    (await api.get<{ notes: NursingNote[] }>(`/nursing/notes?patientId=${encodeURIComponent(patientId)}`)).notes,
  createNote: (data: NoteInput) => api.post<{ note: NursingNote }>("/nursing/notes", data),
};
