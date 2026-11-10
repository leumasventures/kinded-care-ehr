import { useMemo, useState, type FormEvent } from "react";
import { Plus, Printer, Search } from "lucide-react";
import { STORE_KEYS, saveStore, usePersisted } from "../services/store";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../services/audit";
import Modal from "../components/billing/Modal";
import ClaimPrint from "../components/billing/ClaimPrint";
import { balanceOf, formatDate, formatNaira, loadInvoices, todayISO, uid, type Invoice } from "../types/billing";
import { CLAIM_STATUSES, claimOutstanding, claimTotal, claimableByPayer, loadClaims, nextClaimNumber, type Claim, type ClaimStatus } from "../types/claims";
import { loadPatients } from "../types/patients";

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const badge: Record<ClaimStatus, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Submitted: "bg-sky-50 text-sky-700",
  Approved: "bg-amber-50 text-amber-800",
  Rejected: "bg-rose-50 text-rose-700",
  Paid: "bg-emerald-50 text-emerald-700",
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const daysSince = (iso?: string) => (iso ? Math.max(0, Math.round((Date.parse(`${todayISO()}T00:00:00`) - Date.parse(`${iso}T00:00:00`)) / 86_400_000)) : 0);

function NewClaim({ claims, onCreate, onClose }: { claims: Claim[]; onCreate: (c: { payer: string; type: string; ids: string[] }) => void; onClose: () => void }) {
  const groups = useMemo(() => claimableByPayer(loadInvoices(), loadPatients(), claims), [claims]);
  const [payer, setPayer] = useState(groups[0]?.[0] ?? "");
  const group = groups.find(([name]) => name === payer);
  const [ids, setIds] = useState<string[] | null>(null);
  const chosen = ids ?? group?.[1].rows.map((r) => r.invoice.id) ?? []; // everything ticked until the user changes it
  const total = group ? group[1].rows.filter((r) => chosen.includes(r.invoice.id)).reduce((s, r) => s + r.balance, 0) : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!group || chosen.length === 0) return;
    onCreate({ payer, type: group[1].type, ids: chosen });
  };

  return (
    <Modal title="New claim" onClose={onClose} wide>
      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">No unpaid invoices for insured patients are waiting for a claim. A patient's insurer is set on their patient record.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Insurer / HMO / company</span>
            <select className={inputClass} value={payer} onChange={(e) => { setPayer(e.target.value); setIds(null); }}>
              {groups.map(([name, g]) => <option key={name} value={name}>{name} ({g.type}, {g.rows.length} invoice{g.rows.length === 1 ? "" : "s"})</option>)}
            </select>
          </label>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {group?.[1].rows.map((r) => (
              <li key={r.invoice.id}>
                <label className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={chosen.includes(r.invoice.id)} onChange={() => setIds(chosen.includes(r.invoice.id) ? chosen.filter((x) => x !== r.invoice.id) : [...chosen, r.invoice.id])} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                    <span>
                      <span className="block text-slate-800">{r.patient.name} · {r.invoice.number}</span>
                      <span className="block text-xs text-slate-500">{formatDate(r.invoice.date)}{r.patient.memberId ? ` · Member ${r.patient.memberId}` : " · no member ID on file"}</span>
                    </span>
                  </span>
                  <span className="font-medium text-slate-800">{formatNaira(r.balance)}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">{chosen.length} invoice{chosen.length === 1 ? "" : "s"} · <span className="font-semibold text-slate-800">{formatNaira(total)}</span></p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={chosen.length === 0} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Create draft claim</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ClaimDetail({ claim, canEdit, onChange, onDelete, onPrint, onClose }: { claim: Claim; canEdit: boolean; onChange: (c: Claim, note: string, payment?: { amount: number; date: string; reference: string }) => string | void; onDelete: () => void; onPrint: () => void; onClose: () => void }) {
  const total = claimTotal(claim);
  const outstanding = claimOutstanding(claim);
  const [submittedOn, setSubmittedOn] = useState(todayISO());
  const [reference, setReference] = useState(claim.reference ?? "");
  const [approved, setApproved] = useState(String(total));
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(String(outstanding));
  const [payDate, setPayDate] = useState(todayISO());
  const [payRef, setPayRef] = useState("");
  const [error, setError] = useState("");

  const act = (next: Claim, note: string, payment?: { amount: number; date: string; reference: string }) => {
    const err = onChange({ ...next, history: [...claim.history, { at: Date.now(), by: "", text: note }] }, note, payment);
    if (err) setError(err);
  };

  return (
    <Modal title={`${claim.number} · ${claim.payer}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[claim.status]}`}>{claim.status}</span>
          <span className="text-slate-600">Claimed {formatNaira(total)}{claim.approvedAmount !== undefined && ` · Approved ${formatNaira(claim.approvedAmount)}`} · Received {formatNaira(claim.receivedAmount)} · <span className="font-medium text-slate-800">Outstanding {formatNaira(outstanding)}</span></span>
          <button onClick={onPrint} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"><Printer size={14} /> Print schedule</button>
        </div>
        {claim.rejectionReason && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Rejected: {claim.rejectionReason}</p>}

        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Member ID</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {claim.lines.map((l) => <tr key={l.invoiceId}><td className="px-3 py-2">{l.number}</td><td className="px-3 py-2">{l.patient}</td><td className="px-3 py-2 text-slate-500">{l.memberId ?? "—"}</td><td className="px-3 py-2 text-right">{formatNaira(l.amount)}</td></tr>)}
          </tbody>
        </table>

        {canEdit && claim.status === "Draft" && (
          <form onSubmit={(e) => { e.preventDefault(); act({ ...claim, status: "Submitted", submittedOn, reference: reference.trim() || undefined }, `Submitted to ${claim.payer}${reference.trim() ? ` (ref ${reference.trim()})` : ""}`); }} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
            <label className="text-sm"><span className="mb-1 block text-slate-600">Date sent</span><input type="date" className={inputClass} value={submittedOn} max={todayISO()} onChange={(e) => setSubmittedOn(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Payer's reference (optional)</span><input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
            <div className="flex items-end gap-2">
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Mark as submitted</button>
              <button type="button" onClick={onDelete} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">Delete draft</button>
            </div>
          </form>
        )}

        {canEdit && claim.status === "Submitted" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <form onSubmit={(e) => { e.preventDefault(); const n = Number(approved); if (!(n > 0) || n > total) return setError(`Enter an approved amount between ₦1 and ${formatNaira(total)}.`); act({ ...claim, status: "Approved", approvedAmount: round2(n) }, `Approved ${formatNaira(round2(n))} of ${formatNaira(total)}`); }} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <label className="block text-sm"><span className="mb-1 block text-slate-600">Amount approved by the payer</span><input type="number" step="0.01" className={inputClass} value={approved} onChange={(e) => setApproved(e.target.value)} /></label>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Record approval</button>
            </form>
            <form onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) return setError("Say why the payer rejected it."); act({ ...claim, status: "Rejected", rejectionReason: reason.trim() }, `Rejected: ${reason.trim()}`); }} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <label className="block text-sm"><span className="mb-1 block text-slate-600">Reason for rejection</span><input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <button type="submit" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">Record rejection</button>
            </form>
          </div>
        )}

        {canEdit && claim.status === "Approved" && outstanding > 0 && (
          <form onSubmit={(e) => { e.preventDefault(); const n = round2(Number(amount)); if (!(n > 0) || n > outstanding) return setError(`Enter an amount between ₦1 and ${formatNaira(outstanding)}.`); if (payDate > todayISO()) return setError("The payment date can't be in the future."); act({ ...claim, receivedAmount: round2(claim.receivedAmount + n), status: round2(claim.receivedAmount + n) >= (claim.approvedAmount ?? 0) ? "Paid" : "Approved" }, `Received ${formatNaira(n)}${payRef.trim() ? ` (ref ${payRef.trim()})` : ""}`, { amount: n, date: payDate, reference: payRef.trim() }); }} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-4">
            <label className="text-sm"><span className="mb-1 block text-slate-600">Amount received</span><input type="number" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Date</span><input type="date" className={inputClass} value={payDate} max={todayISO()} onChange={(e) => setPayDate(e.target.value)} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Transfer reference</span><input className={inputClass} value={payRef} onChange={(e) => setPayRef(e.target.value)} /></label>
            <div className="flex items-end"><button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Record payment</button></div>
            <p className="text-xs text-slate-500 sm:col-span-4">The money is applied to the invoices on this claim, oldest first, as "HMO / Insurance" payments.</p>
          </form>
        )}
        {claim.status === "Paid" && claim.approvedAmount !== undefined && claim.approvedAmount < total && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">The payer approved {formatNaira(round2(total - claim.approvedAmount))} less than claimed. That balance is still open on the invoices. Collect it from the patient or write it off in Billing.</p>
        )}

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-medium">History ({claim.history.length + 1})</summary>
          <ul className="mt-2 space-y-1">
            <li>{new Date(claim.createdAt).toLocaleString("en-NG")} · {claim.createdBy}: Created</li>
            {claim.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("en-NG")} · {h.by}: {h.text}</li>)}
          </ul>
        </details>
      </div>
    </Modal>
  );
}

export default function Claims() {
  const { user, can } = useAuth();
  const me = user?.name ?? "Unknown user";
  const [claims, setClaims] = usePersisted<Claim[]>(STORE_KEYS.claims, loadClaims);
  const [status, setStatus] = useState<"all" | ClaimStatus>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<Claim | null>(null);

  const open = claims.find((c) => c.id === openId);
  const rows = claims
    .filter((c) => (status === "all" || c.status === status) && (!query.trim() || `${c.number} ${c.payer} ${c.reference ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => b.createdAt - a.createdAt);
  const awaiting = claims.reduce((s, c) => s + claimOutstanding(c), 0);
  const unclaimed = useMemo(() => claimableByPayer(loadInvoices(), loadPatients(), claims).reduce((s, [, g]) => s + g.rows.reduce((t, r) => t + r.balance, 0), 0), [claims]);

  const create = ({ payer, type, ids }: { payer: string; type: string; ids: string[] }) => {
    const patients = loadPatients();
    const lines = loadInvoices().filter((i) => ids.includes(i.id)).map((i) => ({ invoiceId: i.id, number: i.number, patientId: i.patientId, patient: i.patient, memberId: patients.find((p) => p.id === i.patientId)?.memberId, amount: balanceOf(i) }));
    const claim: Claim = { id: uid(), number: nextClaimNumber(claims), payer, payerType: type, createdAt: Date.now(), createdBy: me, status: "Draft", lines, receivedAmount: 0, history: [] };
    setClaims((p) => [...p, claim]);
    logAudit({ action: "Create", module: "Claims", summary: `Created claim ${claim.number} for ${payer}: ${lines.length} invoice${lines.length === 1 ? "" : "s"}, ${formatNaira(claimTotal(claim))}` });
    setCreating(false);
    setOpenId(claim.id);
  };

  // Money received is applied to the claim's invoices, oldest line first, never beyond what each invoice still owes.
  const update = (next: Claim, note: string, payment?: { amount: number; date: string; reference: string }): string | void => {
    let withBy = { ...next, history: next.history.map((h, i) => (i === next.history.length - 1 ? { ...h, by: me } : h)) };
    if (payment) {
      const invoices = loadInvoices();
      let left = payment.amount;
      const changed: Invoice[] = invoices.map((inv) => {
        const line = withBy.lines.find((l) => l.invoiceId === inv.id);
        if (!line || left <= 0) return inv;
        const pay = Math.min(left, balanceOf(inv));
        if (pay <= 0) return inv;
        left = round2(left - pay);
        return { ...inv, payments: [...inv.payments, { id: uid(), date: payment.date, amount: round2(pay), method: "HMO / Insurance" as const, reference: [withBy.number, payment.reference].filter(Boolean).join(" ") }] };
      });
      if (left > 0) return `Only ${formatNaira(round2(payment.amount - left))} can be applied. The rest of these invoices have already been paid another way.`;
      saveStore(STORE_KEYS.invoices, changed); // TODO: POST the payment and the claim update in one backend transaction
      logAudit({ action: "Payment", module: "Claims", summary: `Received ${formatNaira(payment.amount)} from ${withBy.payer} on ${withBy.number}` });
    } else {
      logAudit({ action: "Update", module: "Claims", summary: `${withBy.number}: ${note}` });
    }
    setClaims((p) => p.map((c) => (c.id === withBy.id ? withBy : c)));
  };

  const remove = (c: Claim) => {
    if (!window.confirm(`Delete draft claim ${c.number}? Its invoices go back to the unclaimed list.`)) return;
    setClaims((p) => p.filter((x) => x.id !== c.id));
    logAudit({ action: "Delete", module: "Claims", summary: `Deleted draft claim ${c.number}` });
    setOpenId(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Owed by payers</p><p className="mt-1 text-2xl font-semibold text-slate-800">{formatNaira(awaiting)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Not yet claimed</p><p className="mt-1 text-2xl font-semibold text-amber-700">{formatNaira(unclaimed)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Rejected claims</p><p className="mt-1 text-2xl font-semibold text-rose-700">{claims.filter((c) => c.status === "Rejected").length}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search claim, payer or reference" className={`${inputClass} w-72 pl-9`} /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="all">All statuses</option>{CLAIM_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        {can("Billing", "create") && <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={16} /> New claim</button>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Claim</th><th className="px-5 py-3">Payer</th><th className="px-5 py-3 text-right">Invoices</th><th className="px-5 py-3 text-right">Claimed</th><th className="px-5 py-3 text-right">Received</th><th className="px-5 py-3 text-right">Outstanding</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Waiting</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-blue-600">{c.number}</td>
                <td className="px-5 py-3 text-slate-800">{c.payer}<span className="block text-xs text-slate-400">{c.payerType}</span></td>
                <td className="px-5 py-3 text-right text-slate-600">{c.lines.length}</td>
                <td className="px-5 py-3 text-right">{formatNaira(claimTotal(c))}</td>
                <td className="px-5 py-3 text-right text-slate-600">{formatNaira(c.receivedAmount)}</td>
                <td className="px-5 py-3 text-right font-medium">{formatNaira(claimOutstanding(c))}</td>
                <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[c.status]}`}>{c.status}</span></td>
                <td className="px-5 py-3 text-slate-500">{(c.status === "Submitted" || c.status === "Approved") && c.submittedOn ? `${daysSince(c.submittedOn)} days` : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-400">No claims yet. Use New claim to bill an insurer for unpaid invoices.</td></tr>}
          </tbody>
        </table>
      </div>

      {creating && <NewClaim claims={claims} onCreate={create} onClose={() => setCreating(false)} />}
      {open && <ClaimDetail key={`${open.id}-${open.status}-${open.receivedAmount}`} claim={open} canEdit={can("Billing", "edit")} onChange={update} onDelete={() => remove(open)} onPrint={() => setPrinting(open)} onClose={() => setOpenId(null)} />}
      {printing && <ClaimPrint claim={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}