// Backup and restore of everything the app keeps in this browser.
// MOCK: the real system should back up the MySQL database on a schedule (and test restores), not rely on a person downloading a file.
// TODO: replace with a server-side backup job; keep this export only as a convenience for admins.
import { logAudit } from "./audit";

const APP = "hospital-ms-backup";
const SESSION_KEY = "hms_auth_user";
const LAST_KEY = "hms_last_backup";
/** Never overwritten by a restore: the audit trail must not be rolled back, and the current session must stay. */
const KEEP_ON_RESTORE = new Set([SESSION_KEY, LAST_KEY, "hms_audit", "hms_audit_seq"]);

export interface BackupFile {
  app: typeof APP;
  version: 1;
  createdAt: number;
  createdBy: string;
  keys: Record<string, string>;
}

const dataKeys = () => {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("hms_") && k !== SESSION_KEY && k !== LAST_KEY) out.push(k);
    }
  } catch {
    /* storage unavailable */
  }
  return out.sort();
};

export function backupSummary() {
  const keys = dataKeys();
  const bytes = keys.reduce((s, k) => s + (localStorage.getItem(k)?.length ?? 0), 0);
  let last: number | null = null;
  try {
    last = Number(localStorage.getItem(LAST_KEY)) || null;
  } catch {
    /* ignore */
  }
  return { keys: keys.length, kb: Math.max(1, Math.round(bytes / 1024)), last };
}

export function makeBackup(by: string): BackupFile {
  const keys: Record<string, string> = {};
  for (const k of dataKeys()) keys[k] = localStorage.getItem(k) ?? "";
  return { app: APP, version: 1, createdAt: Date.now(), createdBy: by, keys };
}

export function downloadBackup(by: string) {
  const file = makeBackup(by);
  const d = new Date(file.createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  const name = `hospital-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  try {
    localStorage.setItem(LAST_KEY, String(file.createdAt));
  } catch {
    /* ignore */
  }
  logAudit({ action: "Export", module: "Backup", summary: `Downloaded a full backup (${Object.keys(file.keys).length} data sets)`, dedupeMs: 0 });
  return { name, count: Object.keys(file.keys).length };
}

/** Checks a chosen file is one of our backups and safe to apply. Returns a reason when it is not. */
export function readBackup(text: string): { ok: true; file: BackupFile } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "This file isn't valid JSON, so it can't be a backup from this system." };
  }
  const f = raw as Partial<BackupFile> | null;
  if (!f || f.app !== APP || f.version !== 1 || typeof f.createdAt !== "number" || !f.keys || typeof f.keys !== "object")
    return { ok: false, reason: "This isn't a backup file from this system." };
  for (const [k, v] of Object.entries(f.keys)) {
    if (!k.startsWith("hms_") || KEEP_ON_RESTORE.has(k)) return { ok: false, reason: `The file contains an entry that can't be restored (${k}).` };
    if (typeof v !== "string") return { ok: false, reason: `The data for ${k} is damaged.` };
    try {
      JSON.parse(v);
    } catch {
      return { ok: false, reason: `The data for ${k} is damaged, so nothing was restored.` };
    }
  }
  return { ok: true, file: f as BackupFile };
}

/** Replaces the current data with the backup. The audit log and the current sign-in are kept. */
export function restoreBackup(file: BackupFile) {
  for (const k of dataKeys()) {
    if (!KEEP_ON_RESTORE.has(k)) localStorage.removeItem(k);
  }
  for (const [k, v] of Object.entries(file.keys)) localStorage.setItem(k, v);
  logAudit({ action: "Security", module: "Backup", summary: `Restored data from a backup made ${new Date(file.createdAt).toLocaleString("en-NG")} by ${file.createdBy}`, detail: `${Object.keys(file.keys).length} data sets replaced. The audit log was kept.`, dedupeMs: 0 });
}