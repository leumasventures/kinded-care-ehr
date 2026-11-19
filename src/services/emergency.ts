// "Break glass" access: a staff member without access to patient records can open them read-only for a short time in an emergency.
// They must give a reason. The SERVER starts the clock, ends the grant, refuses anything but reading, and writes the audit log
// (module "Emergency access"). The app only shows the countdown. See context/AuthContext.tsx.
export const EMERGENCY_MINUTES = 60; // must match EMERGENCY_MINUTES on the server; the server's value is what is enforced
export const MIN_REASON_LENGTH = 15;

export interface EmergencyGrant {
  userId: string;
  reason: string;
  startedAt: number;
  expiresAt: number;
}
