// Patient merge must run on the server. These stubs keep the UI compiling.

import type { Patient } from "../types/patients";

export interface MergeLogEntry {
  id: string;
  at: number;
  by: string;
  keptId: string;
  removed: Patient;
  moved: Record<string, number>;
}

export type MergeOk = { moved: Record<string, number> };
export type MergeErr = { reason: string };
export type MergeResult = MergeOk | MergeErr;

/** Why a merge cannot proceed (or null if it can). */
export function mergeBlocker(_keep: Patient, _dupe: Patient): string | null {
  return "Patient merge is handled by the hospital server, not the browser.";
}

/** Counts of linked records that would move with a merge. */
export function recordCounts(_patientId: string): Record<string, number> {
  return {};
}

/**
 * Local merge is disabled. Always returns an error reason.
 * Call signature matches MergeDialog (ids + user name).
 */
export function mergePatients(
  _keepId: string,
  _dupeId: string,
  _by: string
): MergeResult {
  return { reason: "Patient merge is handled by the hospital server, not the browser." };
}

export const loadMergeLog = (): MergeLogEntry[] => [];
