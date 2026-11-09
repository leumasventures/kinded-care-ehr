import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/audit";
import { HOSPITAL, formatDate } from "../../types/billing";
import { daysBetween, type IssuedDoc } from "../../types/documents";
import { fmtDateTime } from "../../types/records";
import { ageLabel, loadPatients } from "../../types/patients";

const printCss = `
@media print {
  body > *:not(.doc-portal) { display: none !important; }
  .doc-portal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; overflow: visible !important; }
  .doc-portal .no-print { display: none !important; }
  .doc-portal .doc-sheet { box-shadow: none !important; border: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important; }
  @page { size: A4; margin: 16mm; }
}
`;

const localDate = (ms: number) => {
  const d = new Date(ms);
  return formatDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{children}</div>
    </section>
  );
}

function MedTable({ meds }: { meds: NonNullable<IssuedDoc["data"]["meds"]> }) {
  return (
    <table className="mt-1 w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-slate-300 text-xs uppercase text-slate-500">
          <th className="py-1.5 pr-3">Drug</th>
          <th className="py-1.5 pr-3">Dose</th>
          <th className="py-1.5 pr-3">How</th>
          <th className="py-1.5">For how long</th>
        </tr>
      </thead>
      <tbody>
        {meds.map((m, i) => (
          <tr key={i} className="border-b border-slate-200 align-top">
            <td className="py-1.5 pr-3 font-medium">{m.drug}</td>
            <td className="py-1.5 pr-3">{m.dose}</td>
            <td className="py-1.5 pr-3">{m.route}, {m.frequency}{m.instructions && <span className="block text-xs text-slate-500">{m.instructions}</span>}</td>
            <td className="py-1.5">{m.duration}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DocumentPrint({ doc, onClose }: { doc: IssuedDoc; onClose: () => void }) {
  const { user } = useAuth();
  const patient = loadPatients().find((p) => p.id === doc.patientId);
  const d = doc.data;
  const days = d.from && d.to ? daysBetween(d.from, d.to) : 0;
  const allergies = d.allergies?.trim();

  const print = () => {
    logAudit({ action: "Export", module: "Documents", summary: `Printed ${doc.type.toLowerCase()} ${doc.number} for ${doc.patientName} (${doc.patientId})`, dedupeMs: 0 });
    window.print();
  };

  return createPortal(
    <div className="doc-portal fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 sm:p-8">
      <style>{printCss}</style>
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end gap-2">
        <button onClick={print} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Printer size={16} /> Print / Save as PDF</button>
        <button onClick={onClose} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"><X size={16} /> Close</button>
      </div>

      <div className="doc-sheet mx-auto min-h-[60rem] max-w-3xl rounded-xl bg-white p-10 text-slate-800 shadow-xl">
        <header className="border-b-2 border-slate-800 pb-3 text-center">
          <h1 className="text-2xl font-bold">{HOSPITAL.name}</h1>
          <p className="text-xs text-slate-600">{HOSPITAL.address}</p>
          <p className="text-xs text-slate-600">{HOSPITAL.phone} · {HOSPITAL.email}</p>
        </header>

        <div className="mt-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold uppercase tracking-wide">{doc.type === "Sick note" ? "Medical certificate (sick note)" : doc.type}</h2>
          <div className="text-right text-xs text-slate-600">
            <p>No. <span className="font-semibold text-slate-800">{doc.number}</span></p>
            <p>Date: {localDate(doc.issuedAt)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm print:bg-transparent">
          <p><span className="text-slate-500">Patient:</span> <span className="font-medium">{doc.patientName}</span></p>
          <p><span className="text-slate-500">Hospital no.:</span> {doc.patientId}</p>
          {patient && <p><span className="text-slate-500">Age / sex:</span> {ageLabel(patient.dob)}, {patient.gender}</p>}
          {patient?.phone && <p><span className="text-slate-500">Phone:</span> {patient.phone}</p>}
          {patient?.address && <p className="col-span-2"><span className="text-slate-500">Address:</span> {patient.address}</p>}
        </div>

        {doc.type === "Sick note" && (
          <>
            <p className="mt-6 text-sm leading-relaxed">
              This is to certify that <span className="font-semibold">{doc.patientName}</span> was seen and treated at this hospital and, in my opinion, is unfit for work or school
              from <span className="font-semibold">{d.from && formatDate(d.from)}</span> to <span className="font-semibold">{d.to && formatDate(d.to)}</span> ({days} day{days === 1 ? "" : "s"}) inclusive.
            </p>
            {d.showDiagnosis && d.diagnosis && <Block title="Diagnosis (included at the patient's request)">{d.diagnosis}</Block>}
            {d.remarks && <Block title="Remarks">{d.remarks}</Block>}
          </>
        )}

        {doc.type === "Referral letter" && (
          <>
            <p className="mt-6 text-sm">
              To: <span className="font-semibold">{d.recipient || "The attending doctor"}</span>
              {d.specialty && <> · {d.specialty}</>}
              {d.facility && <> · {d.facility}</>}
            </p>
            <p className="mt-1 text-sm">Urgency: <span className="font-semibold">{d.urgency}</span></p>
            <p className="mt-4 text-sm">Dear Colleague,</p>
            <Block title="Reason for referral">{d.reason}</Block>
            <Block title="Clinical summary">{d.summary}</Block>
            {d.investigations && <Block title="Investigations and results">{d.investigations}</Block>}
            {d.meds && d.meds.length > 0 && <section className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current medication</h3><MedTable meds={d.meds} /></section>}
            <p className="mt-5 text-sm">Thank you for seeing this patient. Please send your findings to us.</p>
          </>
        )}

        {doc.type === "Prescription" && (
          <>
            {d.diagnosis && <Block title="Diagnosis">{d.diagnosis}</Block>}
            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medication</h3>
              {d.meds && <MedTable meds={d.meds} />}
            </section>
            {d.remarks && <Block title="Advice">{d.remarks}</Block>}
          </>
        )}

        {doc.type === "Discharge summary" && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <p><span className="text-slate-500">Admission:</span> {d.admissionId}</p>
              <p><span className="text-slate-500">Ward:</span> {d.ward}</p>
              <p><span className="text-slate-500">Admitted:</span> {d.admittedOn && formatDate(d.admittedOn)}</p>
              <p><span className="text-slate-500">Discharged:</span> {d.dischargedOn && formatDate(d.dischargedOn)}</p>
              <p className="col-span-2"><span className="text-slate-500">Outcome:</span> {d.outcome}</p>
            </div>
            <Block title="Diagnosis">{d.diagnosis}</Block>
            <Block title="Hospital course and treatment">{d.course}</Block>
            {d.meds && d.meds.length > 0 && <section className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medication on discharge</h3><MedTable meds={d.meds} /></section>}
            {(d.followUp || d.followUpDate) && (
              <Block title="Follow-up">{d.followUp}{d.followUpDate && `${d.followUp ? "\n" : ""}Review on ${formatDate(d.followUpDate)}.`}</Block>
            )}
          </>
        )}

        {allergies && doc.type !== "Sick note" && <p className="mt-5 text-sm"><span className="font-semibold">Known allergies:</span> {allergies}</p>}
        {!allergies && doc.type !== "Sick note" && <p className="mt-5 text-sm text-slate-500">No known allergies on record.</p>}

        <div className="mt-14 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1 font-medium">{doc.issuedBy}</p>
            <p className="text-xs text-slate-500">{doc.issuedRole} · Signature</p>
          </div>
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1 text-xs text-slate-500">Hospital stamp</p>
          </div>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-2 text-[11px] text-slate-400">
          {doc.number} · Issued {fmtDateTime(doc.issuedAt)} by {doc.issuedBy}. Printed {fmtDateTime(Date.now())}{user ? ` by ${user.name}` : ""}. This document is valid only when signed and stamped. Confidential medical information.
        </footer>
      </div>
    </div>,
    document.body
  );
}