import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Ban, Download, Minus, Plus, Search, ArrowLeftRight } from "lucide-react";
import Modal from "../billing/Modal";
import { formatDate, formatNaira, todayISO } from "../../types/billing";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isLive,
  monthLabel,
  monthOf,
  round2,
  uid,
  type Txn,
  type TxnType,
} from "../../types/account";
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

// Spreadsheet apps run text starting with = + - @ as a formula, so neutralise those cells.
const csvCell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

function TxnForm({ type, ledger, onClose }: { type: TxnType; ledger: Ledger; onClose: () => void }) {
  const { data, commit, balances, me } = ledger;
  const accounts = data.accounts.filter((a) => a.active);
  const categories = type === "Income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? "");
  const [category, setCategory] = useState<string>(categories[0]);
  const [description, setDescription] = useState("");
  const [party, setParty] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = round2(Number(amount));
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero.");
    if (!date || date > todayISO()) return setError("Choose a date that is not in the future.");
    if (!accountId) return setError("Choose an account.");
    if (type === "Transfer" && (!toAccountId || toAccountId === accountId)) return setError("Choose a different account to transfer into.");
    if (type !== "Transfer" && !description.trim()) return setError("Add a short description.");
    if (type !== "Income" && (balances[accountId] ?? 0) < value) {
      if (!window.confirm(`This takes ${ledger.accountName(accountId)} below zero (balance ${formatNaira(balances[accountId] ?? 0)}). Record it anyway?`)) return;
    }

    const txn: Txn = {
      id: uid(),
      date,
      type,
      category: type === "Transfer" ? "Transfer between accounts" : category,
      description: description.trim() || `Transfer to ${ledger.accountName(toAccountId)}`,
      party: party.trim(),
      reference: reference.trim(),
      amount: value,
      accountId,
      toAccountId: type === "Transfer" ? toAccountId : undefined,
      source: "manual",
      recordedBy: me,
      recordedAt: Date.now(),
    };
    // TODO: POST /transactions via a services/ call
    commit({ ...data, txns: [...data.txns, txn] });
    onClose();
  };

  const title = type === "Income" ? "Record Income" : type === "Expense" ? "Record Expense" : "Transfer Between Accounts";

  return (
    <Modal title={title} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><input type="date" className={inputClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Amount (₦)"><input type="number" min="0" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label={type === "Income" ? "Paid into" : type === "Expense" ? "Paid from" : "From"}>
            <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({formatNaira(balances[a.id] ?? 0)})</option>
              ))}
            </select>
          </Field>
          {type === "Transfer" ? (
            <Field label="To">
              <select className={inputClass} value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.filter((a) => a.id !== accountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Category">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Description" className="sm:col-span-2"><input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === "Transfer" ? "e.g. Banked cash takings" : "What was this for?"} /></Field>
          {type !== "Transfer" && (
            <>
              <Field label={type === "Income" ? "Received from" : "Paid to"}><input className={inputClass} value={party} onChange={(e) => setParty(e.target.value)} /></Field>
              <Field label="Receipt / reference no. (optional)"><input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
            </>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Recorded by <span className="font-medium text-slate-700">{me}</span>. Entries can't be deleted, only voided with a reason.</p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function VoidDialog({ txn, ledger, onClose }: { txn: Txn; ledger: Ledger; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const confirm = () => {
    if (!reason.trim()) return;
    // TODO: POST /transactions/:id/void via a services/ call
    ledger.commit({
      ...ledger.data,
      txns: ledger.data.txns.map((t) => (t.id === txn.id ? { ...t, voided: { at: Date.now(), by: ledger.me, reason: reason.trim() } } : t)),
    });
    onClose();
  };
  return (
    <Modal title="Void entry" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          {formatDate(txn.date)} · {txn.description} · <span className="font-medium">{formatNaira(txn.amount)}</span>. The entry stays in the ledger marked void and stops counting toward balances.
        </p>
        <Field label="Reason (required)"><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={confirm} disabled={!reason.trim()} className="rounded-lg bg-rose-600 px-5 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-50">Void entry</button>
        </div>
      </div>
    </Modal>
  );
}

const typeStyle: Record<TxnType, string> = {
  Income: "bg-emerald-50 text-emerald-700",
  Expense: "bg-rose-50 text-rose-700",
  Transfer: "bg-slate-100 text-slate-600",
};

export default function Transactions({ ledger }: { ledger: Ledger }) {
  const { txns, data, accountName, can } = ledger;
  const [month, setMonth] = useState("all");
  const [type, setType] = useState<"all" | TxnType>("all");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [form, setForm] = useState<TxnType | null>(null);
  const [voiding, setVoiding] = useState<Txn | null>(null);
  const [page, setPage] = useState(1);
  const PAGE = 15;

  const months = useMemo(() => Array.from(new Set(txns.map((t) => monthOf(t.date)))).sort().reverse(), [txns]);
  const categories = useMemo(() => Array.from(new Set(txns.map((t) => t.category))).sort(), [txns]);

  const rows = txns
    .filter((t) => showVoided || isLive(t))
    .filter((t) => month === "all" || monthOf(t.date) === month)
    .filter((t) => type === "all" || t.type === type)
    .filter((t) => account === "all" || t.accountId === account || t.toAccountId === account)
    .filter((t) => category === "all" || t.category === category)
    .filter((t) => {
      const q = query.trim().toLowerCase();
      return !q || [t.description, t.party, t.reference, t.category].some((v) => v.toLowerCase().includes(q));
    });

  const live = rows.filter(isLive);
  const income = round2(live.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0));
  const expense = round2(live.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0));

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PAGE, safePage * PAGE);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const exportCsv = () => {
    const header = ["Date", "Type", "Category", "Description", "Party", "Reference", "Account", "To account", "Amount", "Status", "Recorded by"];
    const lines = rows.map((t) =>
      [t.date, t.type, t.category, t.description, t.party, t.reference, accountName(t.accountId), t.toAccountId ? accountName(t.toAccountId) : "", String(t.amount), t.voided ? "Void" : "Posted", t.recordedBy]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => reset(() => setQuery(e.target.value))} placeholder="Search description, payee, reference" className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <select value={month} onChange={(e) => reset(() => setMonth(e.target.value))} aria-label="Filter by month" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => reset(() => setType(e.target.value as typeof type))} aria-label="Filter by type" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All types</option>
            <option>Income</option>
            <option>Expense</option>
            <option>Transfer</option>
          </select>
          <select value={account} onChange={(e) => reset(() => setAccount(e.target.value))} aria-label="Filter by account" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All accounts</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select value={category} onChange={(e) => reset(() => setCategory(e.target.value))} aria-label="Filter by category" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showVoided} onChange={(e) => reset(() => setShowVoided(e.target.checked))} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Show voided
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} disabled={rows.length === 0} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={15} /> Export</button>
          {can.create && (
            <>
              <button onClick={() => setForm("Transfer")} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><ArrowLeftRight size={15} /> Transfer</button>
              <button onClick={() => setForm("Expense")} className="flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"><Minus size={15} /> Expense</button>
              <button onClick={() => setForm("Income")} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"><Plus size={15} /> Income</button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Account</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3">Recorded by</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((t) => (
              <tr key={t.id} className={t.voided ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50"}>
                <td className="whitespace-nowrap px-5 py-3">{formatDate(t.date)}</td>
                <td className="px-5 py-3">
                  <p className={`font-medium ${t.voided ? "line-through" : "text-slate-800"}`}>{t.description}</p>
                  <p className="text-xs text-slate-500">
                    {[t.party, t.reference && `Ref ${t.reference}`].filter(Boolean).join(" · ")}
                    {t.voided && ` Void: ${t.voided.reason} (${t.voided.by})`}
                  </p>
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeStyle[t.type]}`}>{t.type}</span>
                  <p className="mt-1 text-xs text-slate-500">{t.category}</p>
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {accountName(t.accountId)}
                  {t.toAccountId && ` → ${accountName(t.toAccountId)}`}
                </td>
                <td className={`whitespace-nowrap px-5 py-3 text-right font-medium ${t.voided ? "line-through" : t.type === "Income" ? "text-emerald-600" : t.type === "Expense" ? "text-rose-600" : "text-slate-600"}`}>
                  {t.type === "Income" ? "+" : t.type === "Expense" ? "−" : ""}{formatNaira(t.amount)}
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">
                  {t.source === "billing" ? "From Billing" : t.source === "payroll" ? `Payroll · ${t.recordedBy}` : t.recordedBy}
                </td>
                <td className="px-5 py-3 text-right">
                  {t.source === "manual" && !t.voided && can.remove && (
                    <button onClick={() => setVoiding(t)} title="Void" aria-label={`Void ${t.description}`} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Ban size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-400">No transactions match these filters.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-50 text-sm font-medium">
              <tr>
                <td colSpan={4} className="px-5 py-3 text-slate-500">All {rows.length} matching entries</td>
                <td colSpan={3} className="px-5 py-3 text-right text-slate-700">
                  <span className="text-emerald-600">In {formatNaira(income)}</span> · <span className="text-rose-600">Out {formatNaira(expense)}</span> · Net {formatNaira(round2(income - expense))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {rows.length > PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {safePage} of {pages}</span>
          <div className="flex gap-2">
            <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">Previous</button>
            <button disabled={safePage === pages} onClick={() => setPage(safePage + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {form && <TxnForm type={form} ledger={ledger} onClose={() => setForm(null)} />}
      {voiding && <VoidDialog txn={voiding} ledger={ledger} onClose={() => setVoiding(null)} />}
    </div>
  );
}