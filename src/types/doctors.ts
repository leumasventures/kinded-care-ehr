export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const; // index matches Date.getDay()

export const SPECIALTIES = [
  "General Medicine",
  "Internal Medicine",
  "Obstetrics & Gynaecology",
  "Paediatrics",
  "Surgery",
  "Orthopaedics",
  "Cardiology",
  "Psychiatry",
  "ENT",
  "Ophthalmology",
  "Radiology",
  "Other",
] as const;

export const DOCTOR_STATUSES = ["Available", "Not Onseat", "On Leave"] as const;
export type DoctorStatus = (typeof DOCTOR_STATUSES)[number];

export interface Doctor {
  id: string;
  name: string; // must match the names used on Appointments and Admissions (e.g. "Dr. Eze")
  specialty: string;
  phone: string;
  email: string;
  days: number[]; // working days, 0 = Sunday … 6 = Saturday
  start: string; // HH:mm
  end: string; // HH:mm
  status: DoctorStatus;
}

export const worksToday = (d: Doctor) => d.days.includes(new Date().getDay());

export function scheduleLabel(d: Doctor) {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
  };
  return `${fmt(d.start)} – ${fmt(d.end)}`;
}

export function nextDoctorId(list: Doctor[]) {
  const max = list.reduce((m, d) => Math.max(m, parseInt(d.id.replace(/\D/g, ""), 10) || 0), 0);
  return `DR-${String(max + 1).padStart(2, "0")}`;
}

// Mock seed data. Replace with a services/ call when the backend is ready.
export const seedDoctors: Doctor[] = [];
