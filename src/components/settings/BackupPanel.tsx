import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { backupSummary, downloadBackup, readBackup, restoreBackup, type BackupFile } from "../../services/backup";
import { fmtDateTime } from "../../types/records";

const DAY = 86_400_000;

export default function BackupPanel() {
  const { user } = useAuth();
  const [info, setInfo] = useState(backupSummary);
  const [file, setFile] = useState<BackupFile | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);

  if (!user?.isAdmin) return null;

  const stale = !info.last || Date.now() - info.last > 7 * DAY;

  const pick = async (f: File | undefined) => {
    setError("");
    setFile(null);
    setTyped("");
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return setError("That file is too large to be one of our backups.");
    const res = readBackup(await f.text());
    if (!res.ok) return setError(res.reason);
    setFile(res.file);
  };

  const apply = () => {
    if (!file || typed !== "RESTORE") return;
    restoreBackup(file);
    window.location.reload();
  };

  return (
    <section className="max-w-3xl rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-800">Backup and restore</h2>
        <p className="mt-0.5 text-xs text-slate-500">Administrators only. A backup holds every patient, billing, pharmacy and staff record kept on this computer.</p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {info.keys} data sets, about {info.kb} KB. {info.last ? `Last backup: ${fmtDateTime(info.last)}.` : "No backup has been downloaded from this computer yet."}
            {stale && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">Back up now</span>}
          </p>
          <button
            type="button"
            onClick={() => {
              const r = downloadBackup(user.name);
              setInfo(backupSummary());
              setNotice(`Saved ${r.name}.`);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Download size={15} /> Download backup
          </button>
        </div>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The file contains patient records and staff password hashes. Keep it somewhere private, and never email or share it.
        </p>
        {notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700">Restore from a backup</h3>
          <input ref={input} type="file" accept="application/json,.json" onChange={(e) => pick(e.target.files?.[0])} className="mt-2 block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700" />
          {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
          {file && (
            <div className="mt-3 space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p>
                This backup was made {fmtDateTime(file.createdAt)} by {file.createdBy} and holds {Object.keys(file.keys).length} data sets.
                <strong> Restoring replaces everything now on this computer</strong>, including changes made since that date. The audit log and your current sign-in are kept.
              </p>
              <p>Download a backup of the current data first if you might need it.</p>
              <div className="flex flex-wrap items-center gap-3">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type RESTORE to confirm" aria-label="Type RESTORE to confirm" className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-800" />
                <button type="button" disabled={typed !== "RESTORE"} onClick={apply} className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40"><Upload size={15} /> Restore</button>
                <button type="button" onClick={() => { setFile(null); setTyped(""); if (input.current) input.current.value = ""; }} className="text-sm text-rose-700 hover:underline">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}