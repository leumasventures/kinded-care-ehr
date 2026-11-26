// Appointments as stored in the hospital database. Pages call these instead of reading the browser's storage.
import { api } from "./api";
import type { Appointment, AppointmentStatus } from "../types/appointments";

export interface AppointmentInput {
  patientId: string;
  doctor: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm, one of the half-hour slots
  type: string;
  reason?: string;
}

export interface AppointmentFilters {
  date?: string;
  from?: string;
  to?: string;
  doctor?: string;
  patientId?: string;
  status?: AppointmentStatus;
  /** Newest first instead of oldest first (the server returns at most `limit` rows, so this matters for "all"). */
  newestFirst?: boolean;
  limit?: number;
}

function queryString(f: AppointmentFilters) {
  const p = new URLSearchParams();
  for (const k of ["date", "from", "to", "doctor", "patientId", "status"] as const) if (f[k]) p.set(k, f[k] as string);
  if (f.newestFirst) p.set("sort", "desc");
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const appointmentsApi = {
  list: async (f: AppointmentFilters = {}) => (await api.get<{ appointments: Appointment[] }>(`/appointments${queryString(f)}`)).appointments ?? [],
  /** Answers 409 with code "slot_taken" when the doctor is already booked at that time. */
  create: (data: AppointmentInput) => api.post<{ appointment: Appointment }>("/appointments", data),
  /** Only a Scheduled or Checked-in appointment can be changed. The patient can't be changed: cancel and book again. */
  update: (id: string, data: Partial<Omit<AppointmentInput, "patientId">>) => api.put<{ appointment: Appointment }>(`/appointments/${id}`, data),
  setStatus: (id: string, status: AppointmentStatus) =>
    api.post<{ appointment: Appointment }>(`/appointments/${id}/status`, { status }),
  remove: (id: string) => api.del<{ ok: boolean }>(`/appointments/${id}`),
};
