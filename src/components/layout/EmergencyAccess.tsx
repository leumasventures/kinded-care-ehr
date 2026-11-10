import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import Modal from "../billing/Modal";
import { useAuth, type AuthUser } from "../../context/AuthContext";
import { EMERGENCY_MINUTES, MIN_REASON_LENGTH } from "../../services/emergency";

/** True when the person's role has no access to patient records, so emergency access is the only way in. */
const lacksPatients = (u: AuthUser | null) => !!u && !u.isAdmin && !u.permissions["Patients"]?.view;

/** Opens the reason form. Also used by the "Access denied" screen. */
export function EmergencyDialog({ onClose }: { onClose: () => void }) {
  const { startEmergency } = useAuth();
  const [reason, setReason] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");

  const submit = () => {
    if (reason.trim().length < MIN_REASON_LENGTH) return setError(`Explain the emergency in at least ${MIN_REASON_LENGTH} characters.`);
    if (!agree) return setError("Please confirm you understand this is recorded.");
    startEmergency(reason);
    onClose();
  };

  return (
    <Modal title="Emergency access to patient records" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Use this only when a patient needs urgent care and you need their record. You get <strong>read-only</strong> access to patient records for {EMERGENCY_MINUTES} minutes.
          Your name, the time and your reason are recorded and reviewed by an administrator.
        </p>
        <label className="block">
          <span className="mb-1 block text-slate-600">What is the emergency?</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="e.g. Unconscious patient in the ward, need to check allergies and current drugs"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="flex items-start gap-2 text-slate-700">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600" />
          I understand that misuse of emergency access is a breach of patient confidentiality.
        </label>
        {error && <p role="alert" className="text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-rose-600 px-5 py-2 font-medium text-white hover:bg-rose-700">Open records</button>
        </div>
      </div>
    </Modal>
  );
}

/** Header button, shown only to staff who have no access to patient records and no active grant. */
export function EmergencyButton() {
  const { user, emergency } = useAuth();
  const [open, setOpen] = useState(false);
  if (!lacksPatients(user) || emergency) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
        <ShieldAlert size={14} /> <span className="hidden sm:inline">Emergency access</span>
      </button>
      {open && <EmergencyDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** Bar across the top of the page while emergency access is on, so it can't be forgotten. */
export function EmergencyBanner() {
  const { emergency, endEmergency } = useAuth();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!emergency) return;
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [emergency]);
  if (!emergency) return null;
  const mins = Math.max(0, Math.ceil((emergency.expiresAt - Date.now()) / 60_000));
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-rose-600 px-4 py-2 text-sm text-white">
      <span className="flex items-center gap-2"><ShieldAlert size={16} /> Emergency access is on: patient records, read-only. {mins} minute{mins === 1 ? "" : "s"} left. Everything you open is recorded.</span>
      <button onClick={() => endEmergency("ended")} className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30">End now</button>
    </div>
  );
}