// Audit trail. Every sensitive action calls logAudit(); only administrators can open the log (Admin > Audit Log).
// MOCK: entries are kept in this browser's localStorage. The real backend must write them server-side to an
// append-only table, stamp the time and the caller's IP itself, and never trust what the browser sends.
// TODO: replace the body of logAudit/loadAudit with POST/GET /audit-logs via a services/ call.

export const AUDIT_ACTIONS = [
  "Sign in",
  "Failed sign-in",
  "Sign out",
  "View",
  "Create",
  "Update",
  "Delete",
  "Lock",
  "Unlock",
  "Void",
  "Payment",
  "Export",
  "Security",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  id: string;
  seq: number; // increases by one for every entry, so a missing number shows something was removed
  at: number;
  userId: string;
  userName: string;
  role: string;
  action: AuditAction;
  module: string;
  summary: string;
  detail?: string;
  outcome: "success" | "failure";
  device: string;
}

interface Input {
  action: AuditAction;
  module: string;
  summary: string;
  detail?: string;
  outcome?: "success" | "failure";
  /** Skip an identical entry made within this many milliseconds (default 2000). */
  dedupeMs?: number;
  /** Use when nobody is signed in yet (failed sign-in). */
  actor?: { id?: string; name: string; role?: string };
}

const KEY = "hms_audit";
const SEQ_KEY = "hms_audit_seq";
const MAX_ENTRIES = 10000;

function currentActor(): { id: string; name: string; role: string } {
  try {
    const raw = JSON.parse(localStorage.getItem("hms_auth_user") ?? "null");
    if (raw?.id) return { id: String(raw.id), name: String(raw.name ?? "Unknown"), role: String(raw.roleName ?? "") };
  } catch {
    /* ignore */
  }
  return { id: "anonymous", name: "Not signed in", role: "" };
}

function deviceLabel(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

export function loadAudit(): AuditEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(raw) ? (raw as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

let last: { key: string; at: number } | null = null;

export function logAudit(input: Input) {
  try {
    const actor = input.actor ? { id: input.actor.id ?? "anonymous", name: input.actor.name, role: input.actor.role ?? "" } : currentActor();
    // Ignore an identical entry repeated within two seconds (React re-runs effects in development).
    const key = `${actor.id}|${input.action}|${input.module}|${input.summary}`;
    if (last && last.key === key && Date.now() - last.at < (input.dedupeMs ?? 2000)) return;
    last = { key, at: Date.now() };

    const seq = (Number(localStorage.getItem(SEQ_KEY)) || 0) + 1;
    const entry: AuditEntry = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      seq,
      at: Date.now(),
      userId: actor.id,
      userName: actor.name,
      role: actor.role,
      action: input.action,
      module: input.module,
      summary: input.summary,
      detail: input.detail,
      outcome: input.outcome ?? "success",
      device: deviceLabel(),
    };
    const list = loadAudit();
    list.push(entry);
    localStorage.setItem(KEY, JSON.stringify(list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list));
    localStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    /* auditing must never break the app; the backend version should fail loudly instead */
  }
}

/** Finds entries removed from the log: numbers that jump, or a log that is shorter than the last number issued. */
export function checkIntegrity(entries: AuditEntry[]): { ok: boolean; message: string } {
  if (entries.length === 0) return { ok: true, message: "The log is empty." };
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  const gaps: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].seq !== sorted[i - 1].seq + 1) gaps.push(`${sorted[i - 1].seq + 1}–${sorted[i].seq - 1}`);
  }
  if (gaps.length) return { ok: false, message: `Entries are missing: numbers ${gaps.slice(0, 5).join(", ")}${gaps.length > 5 ? " and more" : ""}.` };
  const issued = Number(localStorage.getItem(SEQ_KEY)) || 0;
  if (issued > sorted[sorted.length - 1].seq) return { ok: false, message: `The newest ${issued - sorted[sorted.length - 1].seq} entr${issued - sorted[sorted.length - 1].seq === 1 ? "y has" : "ies have"} been removed.` };
  if (sorted[0].seq > 1) return { ok: true, message: `No gaps found from entry ${sorted[0].seq} onward. Entries before that were archived after the ${MAX_ENTRIES.toLocaleString("en-NG")}-entry limit.` };
  return { ok: true, message: `All ${sorted.length} entries are present with no gaps.` };
}

/** Compares two lists of records with an `id`, so a page can log what was added, changed or removed. */
export function diffById<T extends { id: string }>(prev: T[], next: T[], same: (a: T, b: T) => boolean) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const after = new Map(next.map((x) => [x.id, x]));
  return {
    created: next.filter((x) => !before.has(x.id)),
    deleted: prev.filter((x) => !after.has(x.id)),
    updated: next.filter((x) => before.has(x.id) && !same(before.get(x.id)!, x)),
  };
}