// "Break glass" access: a staff member without access to patient records can open them read-only for a short time in an emergency.
// They must give a reason; it is written to the audit log (module "Emergency access") for an administrator to review.
// MOCK: the grant lives in this browser tab's sessionStorage. On the backend the server must issue, time-limit and log the grant itself.
// TODO: replace with POST /emergency-access (server stamps the time and expiry) and notify the privacy officer.
export const EMERGENCY_MINUTES = 60;
export const MIN_REASON_LENGTH = 15;
const KEY = "hms_emergency";

export interface EmergencyGrant {
  userId: string;
  reason: string;
  startedAt: number;
  expiresAt: number;
}

export function loadGrant(userId: string | undefined): EmergencyGrant | null {
  if (!userId) return null;
  try {
    const g = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as EmergencyGrant | null;
    if (g && g.userId === userId && typeof g.expiresAt === "number" && g.expiresAt > Date.now()) return g;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveGrant(g: EmergencyGrant | null) {
  try {
    if (g) sessionStorage.setItem(KEY, JSON.stringify(g));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the grant lasts until reload */
  }
}