// Local browser backups are disabled. Operational data is in the hospital database.

export type BackupFile = {
  version: 1;
  createdAt: number;
  createdBy?: string;
  keys: Record<string, string>;
};

export type BackupSummary = {
  keys: number;
  bytes: number;
  kb: number;
  last: number | null;
  message?: string;
};

export function backupSummary(): BackupSummary {
  return {
    keys: 0,
    bytes: 0,
    kb: 0,
    last: null,
    message: "Local backups are disabled. Data is in the hospital database.",
  };
}

export function backupStats(): BackupSummary {
  return backupSummary();
}

/** Local download disabled. */
export function downloadBackup(_by?: string): { name?: string; reason?: string } {
  return { reason: "Local backups are disabled. Data is stored in the hospital database." };
}

export function exportBackup(): never {
  throw new Error("Local backups are disabled.");
}

/** Parse a backup file text. Always fails — restore is server-side only. */
export function readBackup(_text: string): { file: BackupFile } | { reason: string } {
  return { reason: "Local restore is disabled. Data is stored in the hospital database." };
}

export function restoreBackup(_file: BackupFile): { ok: true } | { reason: string } {
  return { reason: "Local restore is disabled. Data is stored in the hospital database." };
}

export function clearOperationalData(): { reason: string } {
  return { reason: "Clearing browser data does nothing: the hospital database is the source of truth." };
}
