// Audit trail. The SERVER writes the log (time, person, address and device come from the server, never from the browser),
// in an append-only, hash-chained table that only administrators can read (Admin > Audit Log).
// Parts of the system that already run on the server log themselves there. For pages that are not on the server yet,
// logAudit() reports the action to the server, which adds who, when and from where. Sign-in, sign-out and security
// events are never accepted from the browser.
import { api, isSignedIn } from "./api";

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
  ip?: string;
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
}

const REPORTABLE = new Set<AuditAction>(["View", "Create", "Update", "Delete", "Lock", "Unlock", "Void", "Payment", "Export"]);
let last: { key: string; at: number } | null = null;

export function logAudit(input: Input) {
  if (!isSignedIn() || !REPORTABLE.has(input.action)) return;
  // Ignore an identical entry repeated within two seconds (React re-runs effects in development).
  const key = `${input.action}|${input.module}|${input.summary}`;
  if (last && last.key === key && Date.now() - last.at < (input.dedupeMs ?? 2000)) return;
  last = { key, at: Date.now() };
  // Fire and forget: a failed report must never break what the person is doing.
  void api.post("/audit/client", { action: input.action, module: input.module, summary: input.summary, detail: input.detail, outcome: input.outcome }).catch(() => undefined);
}

/** Compares two lists of records with an `id`, so a page can log what was added, changed or removed. */
export function diffById<T extends { id: string }>(prev: T[], next: T[], same: (a: any, b: any) => boolean) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const after = new Map(next.map((x) => [x.id, x]));
  return {
    created: next.filter((x) => !before.has(x.id)),
    deleted: prev.filter((x) => !after.has(x.id)),
    updated: next.filter((x) => before.has(x.id) && !same(before.get(x.id)!, x)),
  };
}
