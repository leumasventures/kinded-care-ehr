import { STORE_KEYS, loadStore } from "../services/store";
import { addDaysISO, todayISO } from "./billing";

export const STATUSES = ["Scheduled", "Checked in", "In Progress", "Completed", "Cancelled", "No-show"] as const;
export type AppointmentStatus = (typeof STATUSES)[number];

// priceName must match an item in the Price List so the fee can be shown.
export const VISIT_TYPES = [
  { name: "General consultation", priceName: "General OPD consultation" },
  { name: "Follow-up", priceName: "Follow-up visit (within 7 days)" },
  { name: "Specialist", priceName: "Specialist consultation" },
  { name: "Paediatric", priceName: "Paediatric consultation" },
  { name: "Antenatal", priceName: "Antenatal visit" },
  { name: "Emergency", priceName: "Emergency / casualty consultation" },
] as const;

export type VisitType = (typeof VISIT_TYPES)[number]["name"];

/** Half-hour slots, 8:00 AM to 4:30 PM. */
export const SLOTS: string[] = Array.from({ length: 18 }, (_, i) => {
  const mins = 8 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

export interface Appointment {
  id: string;
  patientId: string; // registered patient (hms_patients)
  patient: string;
  phone?: string;
  doctor: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: VisitType;
  reason?: string;
  status: AppointmentStatus;
}

export const isActive = (s: AppointmentStatus) => s !== "Cancelled" && s !== "No-show";

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export const nowHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Is this doctor already booked at that date and time? */
export const isBooked = (list: Appointment[], doctor: string, date: string, time: string, ignoreId?: string) =>
  list.some((a) => a.id !== ignoreId && a.doctor === doctor && a.date === date && a.time === time && isActive(a.status));

export function nextAppointmentId(list: Appointment[]) {
  const max = list.reduce((m, a) => Math.max(m, parseInt(a.id.replace(/\D/g, ""), 10) || 0), 200);
  return `A-${max + 1}`;
}

const day = (offset: number) => addDaysISO(todayISO(), offset);

// Mock seed data (dates relative to today). Replace with a services/ call when the backend is ready.
export const seedAppointments: Appointment[] = [];

/** Live data (survives reloads). Pages read this instead of the demo seed. */
export const loadAppointments = (): Appointment[] => loadStore(STORE_KEYS.appointments, () => seedAppointments);
