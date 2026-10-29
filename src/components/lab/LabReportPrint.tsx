import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { HOSPITAL, formatDate } from "../../types/billing";
import type { LabOrder } from "../../types/laboratory";

const printCss = `
@media print {
  body > *:not(.labreport-portal) { display: none !important; }
  .labreport-portal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
  .labreport-portal .no-print { display: none !important; }
  .labreport-portal .labreport-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  @page { size: A4; margin: 14mm; }
}
`;

export default function LabReportPrint({ order, onClose }: { order: LabOrder; onClose: () => void }) {
  return createPortal(
    <div className="labreport-portal fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 sm:p-8">
      <style>{printCss}</style>

      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Printer size={16} /> Print / Save as PDF
        </button>
        <button onClick={onClose} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          <X size={16} /> Close
        </button>
      </div>

      <div className="labreport-sheet mx-auto max-w-3xl rounded-xl bg-white p-8 text-slate-800 shadow-xl sm:p-10">
        <div className="border-b border-slate-300 pb-5 text-center">
          <h1 className="text-2xl font-bold">{HOSPITAL.name}</h1>
          <p className="text-sm text-slate-600">{HOSPITAL.address}</p>
          <p className="text-sm text-slate-600">
            {HOSPITAL.phone} · {HOSPITAL.email}
          </p>
          <p className="mt-3 text-lg font-semibold tracking-wide">LABORATORY REPORT</p>
        </div>

        <div className="grid gap-x-8 gap-y-1 py-5 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Patient: </span><span className="font-medium">{order.patient}</span></p>
          <p><span className="text-slate-500">Order no.: </span>{order.id}</p>
          <p><span className="text-slate-500">Requested by: </span>{order.requestedBy}</p>
          <p><span className="text-slate-500">Date requested: </span>{formatDate(order.date)}</p>
          <p><span className="text-slate-500">Priority: </span>{order.priority}</p>
          {order.reportedOn && <p><span className="text-slate-500">Date reported: </span>{formatDate(order.reportedOn)}</p>}
          {order.clinicalNote && <p className="sm:col-span-2"><span className="text-slate-500">Clinical note: </span>{order.clinicalNote}</p>}
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 text-xs uppercase text-slate-600">
              <th className="px-3 py-2">Test</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Reference range</th>
              <th className="px-3 py-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {order.tests.map((t) => {
              const abnormal = t.flag && t.flag !== "Normal";
              return (
                <tr key={t.id} className="border-b border-slate-200 align-top">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className={`px-3 py-2 ${abnormal ? "font-bold" : ""}`}>{t.result ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{t.unit ?? ""}</td>
                  <td className="px-3 py-2 text-slate-600">{t.range ?? ""}</td>
                  <td className={`px-3 py-2 ${abnormal ? "font-bold" : "text-slate-600"}`}>{t.flag ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-14 grid grid-cols-2 gap-10 text-center text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-1">Medical laboratory scientist</div>
          <div className="border-t border-slate-400 pt-1">Pathologist / reviewer</div>
        </div>
        <p className="mt-8 text-center text-xs text-slate-400">Results relate only to the sample received. Interpret with clinical findings.</p>
      </div>
    </div>,
    document.body
  );
}