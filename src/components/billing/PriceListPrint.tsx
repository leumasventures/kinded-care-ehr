import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { HOSPITAL, formatNaira } from "../../types/billing";
import { CATEGORIES, type PriceItem } from "../../types/pricing";

const printCss = `
@media print {
  body > *:not(.pricelist-portal) { display: none !important; }
  .pricelist-portal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
  .pricelist-portal .no-print { display: none !important; }
  .pricelist-portal .pricelist-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .pricelist-portal .category-block { break-inside: avoid-page; }
  @page { size: A4; margin: 14mm; }
}
`;

interface PriceListPrintProps {
  items: PriceItem[];
  onClose: () => void;
}

export default function PriceListPrint({ items, onClose }: PriceListPrintProps) {
  const today = new Date().toLocaleDateString("en-NG", { day: "2-digit", month: "long", year: "numeric" });

  return createPortal(
    <div className="pricelist-portal fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 sm:p-8">
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

      <div className="pricelist-sheet mx-auto max-w-3xl rounded-xl bg-white p-8 text-slate-800 shadow-xl sm:p-10">
        <div className="border-b border-slate-300 pb-5 text-center">
          <h1 className="text-2xl font-bold">{HOSPITAL.name}</h1>
          <p className="text-sm text-slate-600">{HOSPITAL.address}</p>
          <p className="text-sm text-slate-600">
            {HOSPITAL.phone} · {HOSPITAL.email}
          </p>
          <p className="mt-3 text-lg font-semibold tracking-wide">PRICE LIST</p>
          <p className="text-xs text-slate-500">As at {today} · All prices in Nigerian Naira (₦)</p>
        </div>

        {CATEGORIES.map((cat) => {
          const rows = items.filter((i) => i.category === cat);
          if (rows.length === 0) return null;
          return (
            <div key={cat} className="category-block mt-6">
              <h2 className="mb-1 bg-slate-100 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide">{cat}</h2>
              <table className="w-full text-left text-sm">
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id} className="border-b border-slate-100">
                      <td className="w-20 px-3 py-1.5 text-xs text-slate-400">{i.code}</td>
                      <td className="px-3 py-1.5">{i.name}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-500">{i.unit}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatNaira(i.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <p className="mt-8 text-center text-xs text-slate-400">
          Prices are subject to change without notice. Ask the billing desk for HMO and package rates.
        </p>
      </div>
    </div>,
    document.body
  );
}