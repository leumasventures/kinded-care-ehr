import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { HOSPITAL, addDaysISO } from "../../types/billing";
import { fmtDay, shiftTimes, weekDays, type RosterEntry } from "../../types/roster";
import type { StaffMember } from "./ShiftForm";

// While printing: hide the app, show only the roster sheet (landscape, so seven days fit).
const printCss = `
@media print {
  body > *:not(.roster-portal) { display: none !important; }
  .roster-portal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
  .roster-portal .no-print { display: none !important; }
  .roster-portal .roster-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
  @page { size: A4 landscape; margin: 12mm; }
}
`;

export default function RosterPrint({
  start,
  staff,
  entries,
  unitLabel,
  by,
  onClose,
}: {
  start: string;
  staff: StaffMember[];
  entries: RosterEntry[];
  unitLabel: string;
  by: string;
  onClose: () => void;
}) {
  const days = weekDays(start);
  return createPortal(
    <div className="roster-portal fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 sm:p-8">
      <style>{printCss}</style>
      <div className="no-print mx-auto mb-4 flex max-w-6xl justify-end gap-2">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Printer size={16} /> Print / Save as PDF</button>
        <button onClick={onClose} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><X size={16} /> Close</button>
      </div>

      <div className="roster-sheet mx-auto max-w-6xl rounded-xl bg-white p-8 text-slate-800 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{HOSPITAL.name}</h1>
          <p className="text-sm text-slate-600">Duty roster · {fmtDay(days[0])} to {fmtDay(addDaysISO(start, 6))} · {unitLabel}</p>
        </div>
        <table className="mt-4 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5">Staff</th>
              {days.map((d) => (
                <th key={d} className="border border-slate-300 px-2 py-1.5">{fmtDay(d)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="border border-slate-300 px-2 py-1.5"><p className="font-medium">{s.name}</p><p className="text-slate-500">{s.role}</p></td>
                {days.map((d) => (
                  <td key={d} className="border border-slate-300 px-2 py-1.5 align-top">
                    {entries.filter((e) => e.staffId === s.id && e.date === d).map((e) => (
                      <p key={e.id}>
                        <span className="font-medium">{e.shift}</span> {e.shift !== "Leave" && <span className="text-slate-500">({shiftTimes(e.shift)})</span>}
                        {e.unit !== "—" && <span className="block text-slate-600">{e.unit}</span>}
                      </p>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-slate-500">Printed {new Date().toLocaleString("en-NG")} by {by}. Night shifts end at 8am the next morning.</p>
      </div>
    </div>,
    document.body
  );
}