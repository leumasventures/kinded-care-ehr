import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import {
  HOSPITAL,
  balanceOf,
  calcTotals,
  formatDate,
  formatNaira,
  paidTotal,
  statusOf,
  type Invoice,
} from "../../types/billing";

// While printing: hide the app, show only the invoice sheet.
const printCss = `
@media print {
  body > *:not(.invoice-portal) { display: none !important; }
  .invoice-portal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
  .invoice-portal .no-print { display: none !important; }
  .invoice-portal .invoice-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  @page { size: A4; margin: 14mm; }
}
`;

const statusColor: Record<string, string> = {
  Paid: "#047857",
  Partial: "#b45309",
  Unpaid: "#be123c",
  Overdue: "#be123c",
};

interface InvoicePrintProps {
  invoice: Invoice;
  onClose: () => void;
}

export default function InvoicePrint({ invoice, onClose }: InvoicePrintProps) {
  const totals = calcTotals(invoice);
  const paid = paidTotal(invoice);
  const balance = balanceOf(invoice);
  const status = statusOf(invoice);

  return createPortal(
    <div className="invoice-portal fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 sm:p-8">
      <style>{printCss}</style>

      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <X size={16} /> Close
        </button>
      </div>

      <div className="invoice-sheet mx-auto max-w-3xl rounded-xl bg-white p-8 text-slate-800 shadow-xl sm:p-10">
        <div className="flex items-start justify-between gap-6 border-b border-slate-300 pb-6">
          <div>
            <h1 className="text-2xl font-bold">{HOSPITAL.name}</h1>
            <p className="mt-1 text-sm text-slate-600">{HOSPITAL.address}</p>
            <p className="text-sm text-slate-600">
              {HOSPITAL.phone} · {HOSPITAL.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tracking-wide">INVOICE</p>
            <p className="mt-1 text-sm font-medium">{invoice.number}</p>
            <p className="mt-2 text-sm font-bold uppercase" style={{ color: statusColor[status] }}>
              {status}
            </p>
          </div>
        </div>

        <div className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Billed to</p>
            <p className="mt-1 font-medium">{invoice.patient}</p>
            {invoice.patientPhone && <p className="text-sm text-slate-600">{invoice.patientPhone}</p>}
          </div>
          <div className="text-sm sm:text-right">
            <p>
              <span className="text-slate-500">Invoice date: </span>
              {formatDate(invoice.date)}
            </p>
            <p>
              <span className="text-slate-500">Due date: </span>
              {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 text-xs uppercase text-slate-600">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit price</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((i, idx) => (
              <tr key={i.id} className="border-b border-slate-200">
                <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                <td className="px-3 py-2">{i.description}</td>
                <td className="px-3 py-2 text-right">{i.qty}</td>
                <td className="px-3 py-2 text-right">{formatNaira(i.unitPrice)}</td>
                <td className="px-3 py-2 text-right">{formatNaira(i.qty * i.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span>{formatNaira(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Discount</span>
              <span>− {formatNaira(totals.discount)}</span>
            </div>
          )}
          {invoice.vatRate > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">VAT ({invoice.vatRate}%)</span>
              <span>{formatNaira(totals.vat)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-1 font-semibold">
            <span>Total</span>
            <span>{formatNaira(totals.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Amount paid</span>
            <span>{formatNaira(paid)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-1 text-base font-bold">
            <span>Balance due</span>
            <span>{formatNaira(balance)}</span>
          </div>
        </div>

        {invoice.payments.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Payments received</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs uppercase text-slate-500">
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Method</th>
                  <th className="py-1 pr-3">Reference</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1 pr-3">{formatDate(p.date)}</td>
                    <td className="py-1 pr-3">{p.method}</td>
                    <td className="py-1 pr-3">{p.reference ?? "—"}</td>
                    <td className="py-1 text-right">{formatNaira(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {invoice.notes && (
          <div className="mt-6 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Notes</p>
            <p className="mt-1 text-slate-700">{invoice.notes}</p>
          </div>
        )}

        <div className="mt-14 grid grid-cols-2 gap-10 text-center text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-1">Authorised signature</div>
          <div className="border-t border-slate-400 pt-1">Patient / Guarantor signature</div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">Thank you for choosing {HOSPITAL.name}.</p>
      </div>
    </div>,
    document.body
  );
}