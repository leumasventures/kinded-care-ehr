import { useMemo, useState, type FormEvent } from "react";
import { Plus, Printer, Search, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/billing/Modal";
import InvoiceForm from "../components/billing/InvoiceForm";
import InvoicePrint from "../components/billing/InvoicePrint";
import {
  PAYMENT_METHODS,
  balanceOf,
  calcTotals,
  formatDate,
  formatNaira,
  nextInvoiceNumber,
  paidTotal,
  seedInvoices,
  statusOf,
  todayISO,
  uid,
  type Invoice,
  type InvoiceStatus,
  type PaymentMethod,
} from "../types/billing";

const statusStyle: Record<InvoiceStatus, string> = {
  Paid: "bg-emerald-50 text-emerald-700",
  Partial: "bg-amber-50 text-amber-700",
  Unpaid: "bg-slate-100 text-slate-600",
  Overdue: "bg-rose-50 text-rose-700",
};

const FILTERS: ("All" | InvoiceStatus)[] = ["All", "Unpaid", "Partial", "Overdue", "Paid"];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function PaymentModal({
  invoice,
  onSave,
  onClose,
}: {
  invoice: Invoice;
  onSave: (amount: number, method: PaymentMethod, date: string, reference?: string) => void;
  onClose: () => void;
}) {
  const balance = balanceOf(invoice);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0)) return setError("Enter an amount above ₦0.");
    if (n > balance) return setError(`Amount can't exceed the balance of ${formatNaira(balance)}.`);
    onSave(n, method, date, reference.trim() || undefined);
  };

  return (
    <Modal title={`Record payment — ${invoice.number}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {invoice.patient} · Balance due{" "}
          <span className="font-semibold text-slate-800">{formatNaira(balance)}</span>
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Amount (₦)</span>
          <input type="number" min="0" step="0.01" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Method</span>
            <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Date</span>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Reference (optional)</span>
          <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save Payment
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Billing() {
  const { can } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>(seedInvoices);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | InvoiceStatus>("All");
  const [creating, setCreating] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const billed = invoices.reduce((s, i) => s + calcTotals(i).total, 0);
    const collected = invoices.reduce((s, i) => s + paidTotal(i), 0);
    const overdue = invoices.filter((i) => statusOf(i) === "Overdue");
    return {
      billed,
      collected,
      outstanding: billed - collected,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, i) => s + balanceOf(i), 0),
    };
  }, [invoices]);

  const filtered = invoices
    .filter((i) => filter === "All" || statusOf(i) === filter)
    .filter(
      (i) =>
        i.patient.toLowerCase().includes(query.toLowerCase()) ||
        i.number.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));

  const viewing = invoices.find((i) => i.id === viewingId) ?? null;
  const paying = invoices.find((i) => i.id === payingId) ?? null;

  const addInvoice = (inv: Invoice) => {
    setInvoices((prev) => [inv, ...prev]);
    setCreating(false);
    setViewingId(inv.id); // open the printable invoice straight away
  };

  const addPayment = (amount: number, method: PaymentMethod, date: string, reference?: string) => {
    if (!paying) return;
    // TODO: POST to the backend via a services/ call
    setInvoices((prev) =>
      prev.map((i) =>
        i.id === paying.id ? { ...i, payments: [...i.payments, { id: uid(), amount, method, date, reference }] } : i
      )
    );
    setPayingId(null);
  };

  const cards = [
    { label: "Total Billed", value: formatNaira(stats.billed), tone: "text-slate-800" },
    { label: "Collected", value: formatNaira(stats.collected), tone: "text-emerald-600" },
    { label: "Outstanding", value: formatNaira(stats.outstanding), tone: "text-amber-600" },
    {
      label: `Overdue (${stats.overdueCount})`,
      value: formatNaira(stats.overdueAmount),
      tone: "text-rose-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient or invoice no."
                className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    filter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {can("Billing", "create") && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> New Invoice
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Balance</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((i) => {
                const status = statusOf(i);
                const balance = balanceOf(i);
                return (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <button onClick={() => setViewingId(i.id)} className="font-medium text-blue-600 hover:underline">
                        {i.number}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-slate-800">{i.patient}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(i.date)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(i.dueDate)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatNaira(calcTotals(i).total)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatNaira(paidTotal(i))}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">{formatNaira(balance)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[status]}`}>{status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {balance > 0 && can("Billing", "edit") && (
                          <button
                            onClick={() => setPayingId(i.id)}
                            title="Record payment"
                            aria-label={`Record payment for ${i.number}`}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <Wallet size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setViewingId(i.id)}
                          title="View / print"
                          aria-label={`View or print ${i.number}`}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <InvoiceForm number={nextInvoiceNumber(invoices)} onSave={addInvoice} onCancel={() => setCreating(false)} />
      )}
      {paying && <PaymentModal invoice={paying} onSave={addPayment} onClose={() => setPayingId(null)} />}
      {viewing && <InvoicePrint invoice={viewing} onClose={() => setViewingId(null)} />}
    </div>
  );
}