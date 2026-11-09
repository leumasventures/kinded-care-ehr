import { addDaysISO, todayISO } from "./billing";

export const SHIFT_TYPES = [
  { id: "Morning", start: "08:00", end: "14:00", chip: "bg-amber-50 text-amber-800 ring-amber-200" },
  { id: "Afternoon", start: "14:00", end: "20:00", chip: "bg-sky-50 text-sky-800 ring-sky-200" },
  { id: "Night", start: "20:00", end: "08:00", chip: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  { id: "On call", start: "08:00", end: "08:00", chip: "bg-violet-50 text-violet-800 ring-violet-200" },
  { id: "Leave", start: "00:00", end: "23:59", chip: "bg-slate-100 text-slate-600 ring-slate-200" },
] as const;
export type ShiftId = (typeof SHIFT_TYPES)[number]["id"];
export const shiftOf = (id: ShiftId) => SHIFT_TYPES.find((s) => s.id === id) ?? SHIFT_TYPES[0];

export const UNITS = [
  "Outpatient (OPD)",
  "Emergency",
  "General Ward",
  "Maternity",
  "Pediatrics",
  "ICU",
  "Theatre",
  "Laboratory",
  "Pharmacy",
  "Accounts & Billing",
  "Administration",
] as const;

export interface RosterEntry {
  id: string;
  date: string; // YYYY-MM-DD, the day the shift starts
  staffId: string; // matches the user's id, so each person sees their own shifts
  staffName: string;
  staffRole: string;
  shift: ShiftId;
  unit: string;
  note: string;
  createdBy: string;
  createdAt: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- Dates (all local time) ----------
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
export const weekStart = (iso: string) => addDaysISO(iso, -((parse(iso).getDay() + 6) % 7)); // Monday
export const weekDays = (start: string) => Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
export const fmtDay = (iso: string) => parse(iso).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
export const fmtLongDay = (iso: string) => parse(iso).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
};
export const shiftTimes = (id: ShiftId) => {
  const s = shiftOf(id);
  if (id === "Leave") return "All day";
  if (id === "On call") return "24 hours from 8am";
  return `${clock(s.start)} – ${clock(s.end)}`;
};

/** Start and end moments of a shift, in local time. Night and on-call shifts run into the next morning. */
export function shiftWindow(e: Pick<RosterEntry, "date" | "shift">) {
  const s = shiftOf(e.shift);
  const start = new Date(`${e.date}T${s.start}:00`);
  let end = new Date(`${e.date}T${s.end}:00`);
  if (s.end <= s.start) end = new Date(end.getTime() + 86_400_000);
  return { start, end };
}

export function isOnDutyNow(e: RosterEntry, now = new Date()) {
  if (e.shift === "Leave") return false;
  const { start, end } = shiftWindow(e);
  return now >= start && now < end;
}

// ---------- Clash checks ----------
export function clashes(entries: RosterEntry[], staffId: string, date: string, shift: ShiftId, ignoreId?: string) {
  const block: string[] = [];
  const warn: string[] = [];
  const others = entries.filter((e) => e.staffId === staffId && e.id !== ignoreId);
  const sameDay = others.filter((e) => e.date === date);

  sameDay.forEach((e) => {
    if (e.shift === shift) block.push(`already has a ${shift} shift`);
    else if (e.shift === "Leave" || shift === "Leave") warn.push(`is on leave or has a leave entry that day`);
    else warn.push(`also has a ${e.shift} shift that day`);
  });
  const prev = others.find((e) => e.date === addDaysISO(date, -1) && e.shift === "Night");
  if (prev && shift !== "Night" && shift !== "Leave" && shift !== "On call") warn.push("worked a night shift the day before (less than 12 hours of rest)");
  const next = others.find((e) => e.date === addDaysISO(date, 1) && e.shift === "Morning");
  if (next && shift === "Night") warn.push("has a morning shift the next day (less than 12 hours of rest)");
  return { block: Array.from(new Set(block)), warn: Array.from(new Set(warn)) };
}

// ---------- Calendar export (.ics) ----------
export function toIcs(entries: RosterEntry[], title: string) {
  const stamp = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hospital MS//Duty Roster//EN", `X-WR-CALNAME:${esc(title)}`];
  entries.forEach((e) => {
    if (e.shift === "Leave") return;
    const { start, end } = shiftWindow(e);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@hospital-ms`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`${e.shift} shift, ${e.unit}`)}`,
      ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []),
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ---------- Mock store (browser localStorage) ----------
// TODO: replace with services/ calls (GET/POST/PUT/DELETE /roster) once the backend is ready.
const KEY = "hms_roster";

function seed(): RosterEntry[] {
  const monday = weekStart(todayISO());
  const out: RosterEntry[] = [];
  const add = (staffId: string, staffName: string, staffRole: string, offset: number, shift: ShiftId, unit: string, note = "") =>
    out.push({ id: uid(), date: addDaysISO(monday, offset), staffId, staffName, staffRole, shift, unit, note, createdBy: "Admin User", createdAt: Date.now() });

  for (let w = -1; w <= 2; w++) {
    const o = w * 7;
    for (let d = 0; d < 5; d++) {
      add("u-2", "Dr. Eze", "Doctor", o + d, "Morning", "Outpatient (OPD)");
      add("u-1", "Admin User", "Administrator", o + d, "Morning", "Administration");
      add("u-5", "Kelechi Cash", "Cashier", o + d, "Morning", "Accounts & Billing");
    }
    add("u-2", "Dr. Eze", "Doctor", o + 5, "On call", "Emergency", "Reachable on 0803 555 0201");
    for (let d = 0; d < 3; d++) add("u-3", "Chioma Nurse", "Nurse", o + d, "Morning", "General Ward");
    for (let d = 3; d < 5; d++) add("u-3", "Chioma Nurse", "Nurse", o + d, "Night", "General Ward", "Handover at 8am");
  }
  return out.filter((e, i, a) => a.findIndex((x) => x.staffId === e.staffId && x.date === e.date && x.shift === e.shift) === i);
}

export function loadRoster(): RosterEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(raw)) return raw as RosterEntry[];
  } catch {
    /* ignore */
  }
  return seed();
}

export function saveRoster(list: RosterEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: changes last until refresh */
  }
}