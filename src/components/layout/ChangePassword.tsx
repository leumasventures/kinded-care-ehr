import { useState, type FormEvent } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { HOSPITAL } from "../../types/billing";

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/** Shown instead of the app for a new or reset account. Nothing else works until a personal password is chosen. */
export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (next !== again) return setError("The two new passwords don't match.");
    setError("");
    setBusy(true);
    try {
      await changePassword(current, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-slate-800">{HOSPITAL.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome, {user?.name}. Choose your own password to continue.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Temporary password you were given</span>
            <input type="password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">New password</span>
            <input type="password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
            <span className="mt-1 block text-xs text-slate-400">At least 10 characters, with letters and numbers. Don't use your name or email, or a common password.</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">New password again</span>
            <input type="password" className={inputClass} value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
          </label>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={busy || !current || !next || !again} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {busy && <Loader2 size={16} className="animate-spin" />} Save password
          </button>
          <button type="button" onClick={() => void logout()} className="mx-auto flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <LogOut size={12} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
