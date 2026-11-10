import { STORE_KEYS, loadStore, saveStore } from "../services/store";
import { vitalFlags, type Vitals } from "./nursing";

/** Vitals taken by a nurse at check-in, before the doctor sees the patient. One record per reading; the newest is used. */
export interface Triage {
  id: string;
  appointmentId: string;
  patientId: string;
  at: number;
  by: string;
  role: string;
  temp?: number; // °C
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  resp?: number;
  spo2?: number;
  weight?: number; // kg
  height?: number; // cm
  note?: string;
}

// TODO: replace with services/ calls (POST /appointments/:id/triage, GET /appointments/:id/triage).
export const loadTriage = (): Triage[] => loadStore<Triage[]>(STORE_KEYS.triage, () => []);
export const saveTriage = (list: Triage[]) => saveStore(STORE_KEYS.triage, list);

export const latestTriage = (list: Triage[], appointmentId: string) =>
  list.filter((t) => t.appointmentId === appointmentId).sort((a, b) => b.at - a.at)[0];

export const bmi = (t: Pick<Triage, "weight" | "height">) => (t.weight && t.height ? Math.round((t.weight / (t.height / 100) ** 2) * 10) / 10 : undefined);

/** The attention flags nurses already use on the ward (fever, high BP, low oxygen and so on). */
export const triageFlags = (t: Triage) => vitalFlags({ ...t, admissionId: t.appointmentId, recordedAt: t.at, recordedBy: t.by } as Vitals);

export function triageText(t: Triage): string {
  const parts = [
    t.temp !== undefined && `Temp ${t.temp} °C`,
    t.systolic !== undefined && t.diastolic !== undefined && `BP ${t.systolic}/${t.diastolic} mmHg`,
    t.pulse !== undefined && `Pulse ${t.pulse}/min`,
    t.resp !== undefined && `Resp ${t.resp}/min`,
    t.spo2 !== undefined && `SpO2 ${t.spo2}%`,
    t.weight !== undefined && `Weight ${t.weight} kg`,
    t.height !== undefined && `Height ${t.height} cm`,
    bmi(t) !== undefined && `BMI ${bmi(t)}`,
  ].filter(Boolean);
  return parts.join(", ");
}