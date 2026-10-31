import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../services/audit";
import { DEFAULT_SETTINGS, clearSavedSettings, loadSettings, saveSettings, type AppSettings } from "../types/settings";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export default function Settings() {
  const { can } = useAuth();
  const canEdit = can("Settings", "edit");

  const [saved, setSavedSettings] = useState<AppSettings>(loadSettings);
  const [form, setForm] = useState<AppSettings>(saved);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const flash = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(""), 3000);
  };

  const setHospital = (key: keyof AppSettings["hospital"], value: string) => setForm((f) => ({ ...f, hospital: { ...f.hospital, [key]: value } }));
  const setNotify = (key: keyof AppSettings["notify"], value: boolean) => setForm((f) => ({ ...f, notify: { ...f.notify, [key]: value } }));
  const setNum = (key: "lowStockThreshold" | "invoiceDueDays" | "vatPercent" | "sessionTimeoutMins" | "minPasswordLength", raw: string) =>
    setForm((f) => ({ ...f, [key]: raw === "" ? NaN : Number(raw) }));

  const validate = (): string => {
    const h = form.hospital;
    if (!h.name.trim()) return "Hospital name is required.";
    if (h.email.trim() && !isEmail(h.email.trim())) return "Enter a valid hospital email address.";
    if (h.phone.trim() && h.phone.replace(/\D/g, "").length < 7) return "Enter a valid phone number or leave it blank.";
    const within = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
    if (!within(form.lowStockThreshold, 0, 100000)) return "Low stock threshold must be 0 or more.";
    if (!within(form.invoiceDueDays, 0, 365)) return "Invoice due days must be between 0 and 365.";
    if (!within(form.vatPercent, 0, 100)) return "VAT must be between 0 and 100%.";
    if (!within(form.sessionTimeoutMins, 5, 480)) return "Session timeout must be between 5 and 480 minutes.";
    if (!within(form.minPasswordLength, 6, 64)) return "Minimum password length must be between 6 and 64.";
    return "";
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const problem = validate();
    if (problem) return setError(problem);
    const clean: AppSettings = {
      ...form,
      hospital: {
        name: form.hospital.name.trim(),
        address: form.hospital.address.trim(),
        phone: form.hospital.phone.trim(),
        email: form.hospital.email.trim(),
      },
      invoiceFooter: form.invoiceFooter.trim(),
    };
    // TODO: PUT /settings via a services/ call
    const changed = [
      (Object.keys(clean.hospital) as (keyof typeof clean.hospital)[]).some((k) => clean.hospital[k] !== saved.hospital[k]) && "hospital profile",
      (clean.invoiceDueDays !== saved.invoiceDueDays || clean.vatPercent !== saved.vatPercent || clean.invoiceFooter !== saved.invoiceFooter) && "billing defaults",
      (JSON.stringify(clean.notify) !== JSON.stringify(saved.notify) || clean.lowStockThreshold !== saved.lowStockThreshold) && "notifications",
      (clean.sessionTimeoutMins !== saved.sessionTimeoutMins || clean.minPasswordLength !== saved.minPasswordLength) && "security",
    ].filter(Boolean);
    logAudit({ action: changed.includes("security") ? "Security" : "Update", module: "Settings", summary: "Updated settings", detail: changed.length ? `Changed: ${changed.join(", ")}` : undefined });
    saveSettings(clean);
    setSavedSettings(clean);
    setForm(clean);
    setError("");
    flash("Settings saved. New printouts will use the updated hospital details.");
  };

  const discard = () => {
    setForm(saved);
    setError("");
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset all settings to their defaults? This also clears your saved hospital details.")) return;
    clearSavedSettings();
    saveSettings(DEFAULT_SETTINGS); // keeps the live printout header in step
    clearSavedSettings();
    setSavedSettings(DEFAULT_SETTINGS);
    setForm(DEFAULT_SETTINGS);
    setError("");
    logAudit({ action: "Update", module: "Settings", summary: "Reset all settings to defaults" });
    flash("Settings reset to defaults.");
  };

  const h = form.hospital;
  const notifyRows: [keyof AppSettings["notify"], string][] = [
    ["appointments", "New appointment bookings"],
    ["lowStock", "Low pharmacy stock alerts"],
    ["labResults", "Lab results ready"],
    ["overdueInvoices", "Overdue invoice reminders"],
  ];

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-6">
      {!canEdit && <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">You can view these settings but don't have permission to change them.</p>}

      <fieldset disabled={!canEdit} className="space-y-6">
        <Section title="Hospital Profile" hint="Shown at the top of invoices, lab reports and the printed price list.">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Hospital name"><input className={inputClass} value={h.name} onChange={(e) => setHospital("name", e.target.value)} /></Field>
            <Field label="Email"><input type="email" className={inputClass} value={h.email} onChange={(e) => setHospital("email", e.target.value)} /></Field>
            <Field label="Phone"><input className={inputClass} value={h.phone} onChange={(e) => setHospital("phone", e.target.value)} /></Field>
            <Field label="Address"><input className={inputClass} value={h.address} onChange={(e) => setHospital("address", e.target.value)} /></Field>
          </div>
          <div className="border-t border-slate-100 p-5">
            <p className="mb-2 text-xs uppercase text-slate-400">Printout header preview</p>
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <p className="text-lg font-bold text-slate-800">{h.name || "Hospital name"}</p>
              <p className="text-sm text-slate-600">{h.address || "Address"}</p>
              <p className="text-sm text-slate-600">{[h.phone, h.email].filter(Boolean).join(" · ") || "Phone · Email"}</p>
            </div>
          </div>
        </Section>

        <Section title="Billing Defaults" hint="Defaults for new invoices. Amounts are in Nigerian Naira (₦).">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Invoice due after (days)"><input type="number" min={0} className={inputClass} value={Number.isNaN(form.invoiceDueDays) ? "" : form.invoiceDueDays} onChange={(e) => setNum("invoiceDueDays", e.target.value)} /></Field>
            <Field label="VAT (%)" hint="Use 0 if your services are VAT-exempt."><input type="number" min={0} max={100} step="0.1" className={inputClass} value={Number.isNaN(form.vatPercent) ? "" : form.vatPercent} onChange={(e) => setNum("vatPercent", e.target.value)} /></Field>
            <Field label="Invoice footer note" className="sm:col-span-2"><input className={inputClass} value={form.invoiceFooter} onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })} placeholder="e.g. Pay to: Account name, Bank, Account number" /></Field>
          </div>
        </Section>

        <Section title="Notifications">
          <div className="space-y-3 p-5">
            {notifyRows.map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.notify[key]} onChange={(e) => setNotify(key, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                {label}
              </label>
            ))}
            <div className="max-w-xs pt-2">
              <Field label="Low stock threshold (units)" hint="Pharmacy items at or below this are flagged.">
                <input type="number" min={0} className={inputClass} value={Number.isNaN(form.lowStockThreshold) ? "" : form.lowStockThreshold} onChange={(e) => setNum("lowStockThreshold", e.target.value)} disabled={!form.notify.lowStock} />
              </Field>
            </div>
          </div>
        </Section>

        <Section title="Security">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Sign out after inactivity (minutes)"><input type="number" min={5} className={inputClass} value={Number.isNaN(form.sessionTimeoutMins) ? "" : form.sessionTimeoutMins} onChange={(e) => setNum("sessionTimeoutMins", e.target.value)} /></Field>
            <Field label="Minimum password length"><input type="number" min={6} className={inputClass} value={Number.isNaN(form.minPasswordLength) ? "" : form.minPasswordLength} onChange={(e) => setNum("minPasswordLength", e.target.value)} /></Field>
          </div>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">These are stored now and enforced by the backend once it's connected.</p>
        </Section>
      </fieldset>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {canEdit && (
          <>
            <button type="submit" disabled={!dirty} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">Save Changes</button>
            {dirty && <button type="button" onClick={discard} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Discard</button>}
            {dirty && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Unsaved changes</span>}
            <button type="button" onClick={resetDefaults} className="ml-auto text-sm text-slate-500 hover:text-rose-600">Reset to defaults</button>
          </>
        )}
        {notice && <span role="status" className="text-sm text-emerald-600">{notice}</span>}
      </div>
    </form>
  );
}