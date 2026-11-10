import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { HOSPITAL, formatDate, formatNaira } from "../../types/billing";
import { claimTotal, type Claim } from "../../types/claims";

const printCss = `
@media print {
  body > *:not(.claim-portal) { display: none !important; }
  .claim-portal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
  .claim-portal .no-print { display: none !important; }
  .claim-portal .claim-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  @page { size: A4; margin: 14mm; }
}
`;

/** Claim schedule: the covering letter and invoice list sent to the insurer. */
export default function ClaimPrint({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  return createPortal(
    <div className="claim-portal fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 sm:p-8">
      <style>{printCss}</style>
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Printer size={16} /> Print / Save as PDF</button>
        <button onClick={onClose} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><X size={16} /> Close</button>
      </div>
      <div className="claim-sheet mx-auto max-w-3xl rounded-xl bg-white p-10 text-slate-800 shadow-xl">
        <header className="border-b-2 border-slate-800 pb-3 text-center">
          <h1 className="text-2xl font-bold">{HOSPITAL.name}</h1>
          <p className="text-xs text-slate-600">{HOSPITAL.address} · {HOSPITAL.phone} · {HOSPITAL.email}</p>
        </header>
        <h2 className="mt-5 text-xl font-semibold uppercase tracking-wide">Claim schedule</h2>
        <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
          <p><span className="text-slate-500">To:</span> <span className="font-medium">{claim.payer}</span> ({claim.payerType})</p>
          <p className="text-right"><span className="text-slate-500">Claim no.:</span> <span className="font-medium">{claim.number}</span></p>
          <p><span className="text-slate-500">Invoices:</span> {claim.lines.length}</p>
          <p className="text-right"><span className="text-slate-500">Date:</span> {formatDate(claim.submittedOn ?? new Date(claim.createdAt).toISOString().slice(0, 10))}</p>
        </div>
        <table className="mt-5 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-xs uppercase text-slate-500">
              <th className="py-2 pr-3">Invoice</th>
              <th className="py-2 pr-3">Patient</th>
              <th className="py-2 pr-3">Member no.</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {claim.lines.map((l) => (
              <tr key={l.invoiceId} className="border-b border-slate-200">
                <td className="py-1.5 pr-3">{l.number}</td>
                <td className="py-1.5 pr-3">{l.patient} <span className="text-xs text-slate-400">({l.patientId})</span></td>
                <td className="py-1.5 pr-3">{l.memberId || "—"}</td>
                <td className="py-1.5 text-right">{formatNaira(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="pt-3 text-right font-semibold">Total claimed</td><td className="pt-3 text-right text-base font-bold">{formatNaira(claimTotal(claim))}</td></tr>
          </tfoot>
        </table>
        <p className="mt-6 text-sm">Please settle this claim and quote <strong>{claim.number}</strong> with your payment. Itemised invoices are available on request.</p>
        <div className="mt-12 w-64"><div className="h-10 border-b border-slate-400" /><p className="mt-1 text-xs text-slate-500">Authorised signature and stamp</p></div>
      </div>
    </div>,
    document.body
  );
}