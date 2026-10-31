import { useState, type FormEvent, type ReactNode } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import Modal from "../billing/Modal";
import { formatNaira, todayISO } from "../../types/billing";
import { ACCOUNT_KINDS, round2, uid, type AccountKind, type MoneyAccount } from "../../types/account";
import type { Ledger } from "./useLedger";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function AccountForm({ account, ledger, onClose }: { account: MoneyAccount | null; ledger: Ledger; onClose: () => void }) {
  const { data, commit } = ledger;
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "Bank");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "");
  const [opening, setOpening] = useState(String(account?.opening ?? 0));
  const [openingDate, setOpeningDate] = useState(account?.openingDate ?? todayISO());
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = round2(Number(opening));
    if (!name.trim()) return setError("Give the account a name.");
    if (data.accounts.some((a) => a.id !== account?.id && a.name.toLowerCase() === name.trim().toLowerCase())) return setError("An account with that name already exists.");
    if (!Number.isFinite(value) || value < 0) return setError("Opening balance must be zero or more.");
    if (accountNumber.trim() && !/^\d{10}$/.test(accountNumber.trim())) return setError("Nigerian account numbers have 10 digits. Leave blank if not applicable.");
    const next: MoneyAccount = {
      id: account?.id ?? `acc-${uid()}`,
      name: name.trim(),
      kind,
      bankName: kind === "Cash" ? "" : bankName.trim(),
      accountNumber: kind === "Cash" ? "" : accountNumber.trim(),
      opening: value,
      openingDate,
      active: account?.active ?? true,
    };
    // TODO: POST/PUT /accounts via a services/ call
    commit({ ...data, accounts: account ? data.accounts.map((a) => (a.id === account.id ? next : a)) : [...data.accounts, next] });
    onClose();
  };

  return (
    <Modal title={account ? `Edit ${account.name}` : "Register Account"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Account name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Zenith current account" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {ACCOUNT_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          <Field label="Opening balance (₦)"><input type="number" min="0" step="0.01" className={inputClass} value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
          {kind !== "Cash" && (
            <>
              <Field label="Bank / provider"><input className={inputClass} value={bankName} onChange={(e) => setBankName(e.target.value)} /></Field>
              <Field label="Account number"><input inputMode="numeric" className={inputClass} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></Field>
            </>
          )}
          <Field label="Balance as at" className="col-span-2"><input type="date" className={inputClass} value={openingDate} max={todayISO()} onChange={(e) => setOpeningDate(e.target.value)} /></Field>
        </div>
        <p className="text-xs text-slate-500">Balances are the opening balance plus everything recorded from that date.</p>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">{account ? "Save" : "Register"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function MoneyAccounts({ ledger }: { ledger: Ledger }) {
  const { data, commit, balances, can } = ledger;
  const [editing, setEditing] = useState<MoneyAccount | "new" | null>(null);

  const total = round2(data.accounts.filter((a) => a.active).reduce((s, a) => s + (balances[a.id] ?? 0), 0));

  const toggle = (a: MoneyAccount) => {
    if (a.active && !window.confirm(`Deactivate ${a.name}? It stays in the records but can't be used for new entries.`)) return;
    // TODO: PATCH /accounts/:id via a services/ call
    commit({ ...data, accounts: data.accounts.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Where the hospital's money is held. Combined active balance: <span className="font-semibold text-slate-800">{formatNaira(total)}</span></p>
        {can.edit && (
          <button onClick={() => setEditing("new")} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} /> Register account</button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.accounts.map((a) => (
          <div key={a.id} className={`rounded-xl border bg-white p-5 ${a.active ? "border-slate-200" : "border-slate-200 opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{a.name}</p>
                <p className="text-xs text-slate-500">{a.kind}{a.bankName && ` · ${a.bankName}`}{a.accountNumber && ` · ${a.accountNumber}`}</p>
              </div>
              {!a.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactive</span>}
            </div>
            <p className={`mt-3 text-2xl font-semibold ${(balances[a.id] ?? 0) < 0 ? "text-rose-600" : "text-slate-800"}`}>{formatNaira(balances[a.id] ?? 0)}</p>
            <p className="text-xs text-slate-400">Opening {formatNaira(a.opening)} on {a.openingDate}</p>
            {can.edit && (
              <div className="mt-3 flex gap-1 border-t border-slate-100 pt-3">
                <button onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`} title="Edit" className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={15} /></button>
                <button onClick={() => toggle(a)} aria-label={`${a.active ? "Deactivate" : "Activate"} ${a.name}`} title={a.active ? "Deactivate" : "Activate"} className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"><Power size={15} /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && <AccountForm account={editing === "new" ? null : editing} ledger={ledger} onClose={() => setEditing(null)} />}
    </div>
  );
}