import type { ReactNode } from "react";
import { fmtDateTime, toLocalInput } from "../../types/records";

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/** Date/time input that defaults to now and can't be set in the future. */
export function WhenField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <input type="datetime-local" className={inputClass} value={value} max={toLocalInput(Date.now())} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export { fmtDateTime };