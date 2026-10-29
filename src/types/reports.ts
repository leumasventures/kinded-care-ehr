import { addDaysISO, todayISO } from "./billing";

export type Preset = "today" | "7d" | "30d" | "month" | "90d" | "custom";

export const PRESETS: { id: Exclude<Preset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "90d", label: "Last 90 days" },
];

export function rangeForPreset(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const to = todayISO();
  switch (preset) {
    case "today":
      return { from: to, to };
    case "7d":
      return { from: addDaysISO(to, -6), to };
    case "30d":
      return { from: addDaysISO(to, -29), to };
    case "90d":
      return { from: addDaysISO(to, -89), to };
    case "month":
      return { from: `${to.slice(0, 8)}01`, to };
  }
}

export interface DayStats {
  date: string;
  visits: number;
  newPatients: number;
  appointments: number;
  completed: number;
  cancelled: number;
  admissions: number;
  discharges: number;
  labTests: number;
}

// Deterministic pseudo-random so the sample data is stable between renders.
const noise = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * SAMPLE clinical activity for the last `days` days.
 * Replace with a services/ call (e.g. GET /reports/activity?from=&to=) once the backend exists.
 */
export function buildClinicalData(days = 120): DayStats[] {
  const today = todayISO();
  return Array.from({ length: days }, (_, k) => {
    const i = days - 1 - k; // days ago
    const date = addDaysISO(today, -i);
    const dow = new Date(`${date}T00:00:00`).getDay();
    const weekend = dow === 0 || dow === 6;
    const visits = Math.round((weekend ? 10 : 28) + noise(i + 1) * 14);
    const appointments = Math.round(visits * (0.55 + noise(i + 7) * 0.15));
    const cancelled = Math.round(appointments * (0.05 + noise(i + 13) * 0.1));
    return {
      date,
      visits,
      newPatients: Math.round(visits * (0.2 + noise(i + 19) * 0.1)),
      appointments,
      completed: appointments - cancelled,
      cancelled,
      admissions: Math.round(2 + noise(i + 23) * 5),
      discharges: Math.round(1 + noise(i + 29) * 5),
      labTests: Math.round(visits * (0.8 + noise(i + 31) * 0.5)),
    };
  });
}

// Share of OPD visits per diagnosis (sample).
export const DIAGNOSIS_SHARES: [string, number][] = [
  ["Malaria", 0.18],
  ["Upper respiratory tract infection", 0.14],
  ["Hypertension", 0.1],
  ["Typhoid fever", 0.08],
  ["Diabetes mellitus", 0.07],
  ["Gastroenteritis", 0.07],
  ["Urinary tract infection", 0.06],
  ["Pneumonia", 0.04],
  ["Other", 0.26],
];

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}