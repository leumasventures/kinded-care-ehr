import { useMemo, useState } from "react";
import { FileText, Printer } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/audit";
import { DOC_TYPES, loadDocuments, type DocType, type IssuedDoc } from "../../types/documents";
import { canPrescribe, fmtDateTime } from "../../types/records";
import type { Patient } from "../../types/patients";
import DocumentForm from "./DocumentForm";
import DocumentPrint from "./DocumentPrint";

/** The patient chart's Documents tab: issue a document, and reprint the ones already issued. */
export default function PatientDocuments({ patient }: { patient: Patient }) {
  const { user } = useAuth();
  const canIssue = canPrescribe(user); // doctors and administrators
  const [making, setMaking] = useState<DocType | null>(null);
  const [printing, setPrinting] = useState<IssuedDoc | null>(null);
  const [tick, setTick] = useState(0);
  const issued = useMemo(() => loadDocuments().filter((d) => d.patientId === patient.id).sort((a, b) => b.issuedAt - a.issuedAt), [patient.id, tick]);

  const reprint = (d: IssuedDoc) => {
    logAudit({ action: "View", module: "Documents", summary: `Opened ${d.type.toLowerCase()} ${d.number} for ${patient.name} (${patient.id})` });
    setPrinting(d);
  };

  return (
    <div className="space-y-4">
      {canIssue ? (
        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map((t) => (
            <button key={t} onClick={() => setMaking(t)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FileText size={15} className="text-blue-600" /> {t}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Only doctors can issue documents. You can reprint those already issued.</p>
      )}

      <section className="rounded-lg border border-slate-200">
        <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Issued documents ({issued.length})</h3>
        <ul className="divide-y divide-slate-100">
          {issued.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{d.type} <span className="font-normal text-slate-400">· {d.number}</span></p>
                <p className="text-xs text-slate-500">{fmtDateTime(d.issuedAt)} · {d.issuedBy}</p>
              </div>
              <button onClick={() => reprint(d)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"><Printer size={13} /> View / print</button>
            </li>
          ))}
          {issued.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">Nothing issued yet.</li>}
        </ul>
      </section>

      {making && (
        <DocumentForm
          patient={patient}
          type={making}
          onClose={() => setMaking(null)}
          onIssued={(doc) => {
            setMaking(null);
            setTick((n) => n + 1);
            setPrinting(doc);
          }}
        />
      )}
      {printing && <DocumentPrint doc={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}