import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { HOSPITAL } from "../types/billing";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const EMAIL_KEY = "hms_login_email";
const LOCK_KEY = "hms_login_lock";
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

const IS_DEV = !!(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;

// Convenience only, and only in `npm run dev`. These never ship in a production build.
const DEMO_ACCOUNTS = [
  { label: "Administrator", email: "admin@hospital.com" },
  { label: "Doctor", email: "eze@hospital.com" },
  { label: "Nurse", email: "chioma@hospital.com" },
  { label: "Cashier", email: "kelechi@hospital.com" },
];

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: feature just won't persist */
  }
};

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const redirected = !!(location.state as { from?: string } | null)?.from && from !== "/";

  const [email, setEmail] = useState(() => readStored(EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => readStored(EMAIL_KEY) !== null);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(() => Number(readStored(LOCK_KEY)) || 0);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while locked so the countdown updates and the form re-enables itself.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        window.clearInterval(id);
        setLockedUntil(0);
        writeStored(LOCK_KEY, null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  if (user) return <Navigate to={from} replace />;

  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = secondsLeft > 0;

  const onKey = (e: KeyboardEvent) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked || loading) return;
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      writeStored(EMAIL_KEY, remember ? email.trim() : null);
      writeStored(LOCK_KEY, null);
      navigate(from, { replace: true });
    } catch (err) {
      const next = attempts + 1;
      setPassword("");
      if (next >= MAX_ATTEMPTS) {
        // Client-side only: slows casual guessing. Real protection must be enforced by the backend.
        const until = Date.now() + LOCK_SECONDS * 1000;
        setAttempts(0);
        setLockedUntil(until);
        setNow(Date.now());
        writeStored(LOCK_KEY, String(until));
        setError(`Too many failed attempts. Try again in ${LOCK_SECONDS} seconds.`);
      } else {
        setAttempts(next);
        const left = MAX_ATTEMPTS - next;
        setError(`${err instanceof Error ? err.message : "Login failed."}${left <= 2 ? ` ${left} attempt${left === 1 ? "" : "s"} left.` : ""}`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white" aria-hidden="true">
            {HOSPITAL.name.trim().charAt(0).toUpperCase() || "H"}
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-800">{HOSPITAL.name}</h1>
          <p className="text-sm text-slate-500">Sign in to your account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          {redirected && !error && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">Please sign in to continue.</p>}

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Email</span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              autoFocus={!email}
              disabled={locked}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={`${inputClass} pr-10`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKey}
                onKeyUp={onKey}
                onBlur={() => setCapsLock(false)}
                autoComplete="current-password"
                autoFocus={!!email}
                disabled={locked}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {capsLock && (
              <span className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle size={12} /> Caps Lock is on
              </span>
            )}
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Remember my email
            </label>
            <span className="text-xs text-slate-400">Forgot password? Ask an administrator.</span>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          {locked && <p className="text-center text-sm text-slate-500">Sign-in is paused for {secondsLeft}s.</p>}

          <button
            type="submit"
            disabled={loading || locked || !email || !password}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {IS_DEV && (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 text-center">
            <p className="mb-2 text-xs text-slate-400">Dev mode: demo accounts accept any password. Click to fill the email.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setError("");
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}