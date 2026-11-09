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
export const seedAppointments: Appointment[] = [
  { id: "A-201", patientId: "P-1001", patient: "Chidi Okafor", phone: "0803 555 0101", doctor: "Dr. Eze", date: day(0), time: "08:00", type: "General consultation", reason: "Fever and headache", status: "Completed" },
  { id: "A-202", patientId: "P-1002", patient: "Amaka Nwosu", phone: "0802 555 0102", doctor: "Dr. Obi", date: day(0), time: "08:30", type: "Antenatal", reason: "32-week review", status: "In Progress" },
  { id: "A-203", patientId: "P-1003", patient: "Ifeanyi Uche", phone: "0805 555 0103", doctor: "Dr. Eze", date: day(0), time: "09:00", type: "Follow-up", reason: "Typhoid review", status: "Checked in" },
  { id: "A-204", patientId: "P-1004", patient: "Ngozi Eke", phone: "0807 555 0104", doctor: "Dr. Ade", date: day(0), time: "10:00", type: "Paediatric", reason: "Child cough, 3 days", status: "Scheduled" },
  { id: "A-205", patientId: "P-1005", patient: "Emeka Obi", doctor: "Dr. Obi", date: day(0), time: "11:30", type: "General consultation", reason: "Back pain", status: "Scheduled" },
  { id: "A-206", patientId: "P-1006", patient: "Blessing Nnadi", phone: "0809 555 0106", doctor: "Dr. Nwankwo", date: day(0), time: "14:00", type: "Specialist", reason: "Surgical review", status: "Scheduled" },
  { id: "A-207", patientId: "P-1007", patient: "Chinedu Okoro", doctor: "Dr. Eze", date: day(0), time: "15:30", type: "General consultation", status: "Scheduled" },
  { id: "A-208", patientId: "P-1011", patient: "Ada Ibe", phone: "0803 555 0108", doctor: "Dr. Ade", date: day(1), time: "09:30", type: "Follow-up", reason: "Wound check", status: "Scheduled" },
  { id: "A-209", patientId: "P-1012", patient: "Obinna Eze", doctor: "Dr. Obi", date: day(1), time: "11:00", type: "Antenatal", status: "Scheduled" },
  { id: "A-210", patientId: "P-1013", patient: "Mary Nwafor", phone: "0802 555 0110", doctor: "Dr. Eze", date: day(1), time: "13:30", type: "General consultation", reason: "Hypertension review", status: "Scheduled" },
  { id: "A-211", patientId: "P-1010", patient: "Uche Anyanwu", doctor: "Dr. Nwankwo", date: day(2), time: "10:30", type: "Specialist", status: "Scheduled" },
  { id: "A-212", patientId: "P-1009", patient: "Master Kelechi Obi", doctor: "Dr. Ade", date: day(-1), time: "09:00", type: "Paediatric", status: "Completed" },
  { id: "A-213", patientId: "P-1014", patient: "Ijeoma Ude", phone: "0805 555 0113", doctor: "Dr. Eze", date: day(-1), time: "10:30", type: "General consultation", status: "No-show" },
  { id: "A-214", patientId: "P-1015", patient: "Samuel Agu", doctor: "Dr. Obi", date: day(-1), time: "14:30", type: "Follow-up", status: "Cancelled" },
];