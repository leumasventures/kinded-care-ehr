import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Modal from "../billing/Modal";
import { useAuth } from "../../context/AuthContext";
import { logAudit } from "../../services/audit";
import { addDaysISO, todayISO } from "../../types/billing";
import { loadAdmissions, type Admission } from "../../types/admissions";
import { daysBetween, loadDocuments, nextDocNumber, saveDocuments, type DocData, type DocType, type IssuedDoc, type MedLine } from "../../types/documents";
import { allergyList, type Patient } from "../../types/patients";
import { loadRecords, uid } from "../../types/records";
import { inputClass } from "../patients/ui";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const URGENCY = ["Routine", "Urgent", "Emergency"];

/** Collects what a document needs, saves it as an issued record, and hands it back to be printed. */
export default function DocumentForm({
  patient,
  type,
  admissionId,
  onIssued,
  onClose,
}: {
  patient: Patient;
  type: DocType;
  admissionId?: string;
  onIssued: (doc: IssuedDoc) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const today = todayISO();

  const rx = useMemo(() => loadRecords().prescriptions.filter((r) => r.patientId === patient.id && r.status === "Active"), [patient.id]);
  const discharged = useMemo(() => loadAdmissions().filter((a) => a.patientId === patient.id && a.status === "Discharged").sort((a, b) => (b.dischargedOn ?? "").localeCompare(a.dischargedOn ?? "")), [patient.id]);
  const latestNote = useMemo(
    () => loadRecords().notes.filter((n) => n.patientId === patient.id && !n.addendumTo && (n.category === "Consultation" || n.category === "Progress note")).sort((a, b) => b.at - a.at)[0],
    [patient.id]
  );

  const [adm, setAdm] = useState<Admission | undefined>(discharged.find((a) => a.id === admissionId) ?? discharged[0]);
  const [picked, setPicked] = useState<string[]>(type === "Prescription" || type === "Discharge summary" ? rx.map((r) => r.id) : []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosis, setDiagnosis] = useState(type === "Discharge summary" ? adm?.diagnosis ?? "" : "");
  const [remarks, setRemarks] = useState("");
  const [recipient, setRecipient] = useState("");
  const [facility, setFacility] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [urgency, setUrgency] = useState("Routine");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [investigations, setInvestigations] = useState("");
  const [course, setCourse] = useState(type === "Discharge summary" ? adm?.dischargeNotes ?? "" : "");
  const [followUp, setFollowUp] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [error, setError] = useState("");

  const allergies = allergyList(patient).join(", ");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const meds: MedLine[] = rx
    .filter((r) => picked.includes(r.id))
    .map((r) => ({ drug: r.drug, dose: r.dose, route: r.route, frequency: r.frequency, duration: r.duration, instructions: r.instructions }));

  const changeAdmission = (id: string) => {
    const next = discharged.find((a) => a.id === id);
    setAdm(next);
    setDiagnosis(next?.diagnosis ?? "");
    setCourse(next?.dischargeNotes ?? "");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const data: DocData = { allergies };
    if (type === "Sick note") {
      if (!from || !to || to < from) return setError("The end date can't be before the start date.");
      if (daysBetween(from, to) > 90) return setError("A sick note can cover at most 90 days. Issue another note after review.");
      if (showDiagnosis && !diagnosis.trim()) return setError("Enter the diagnosis, or untick the box to leave it off the note.");
      Object.assign(data, { from, to, showDiagnosis, diagnosis: showDiagnosis ? diagnosis.trim() : undefined, remarks: remarks.trim() || undefined });
    } else if (type === "Referral letter") {
      if (!recipient.trim() && !facility.trim()) return setError("Say who or where the patient is being referred to.");
      if (!reason.trim()) return setError("Give the reason for referral.");
      if (!summary.trim()) return setError("Write a short clinical summary.");
      Object.assign(data, { recipient: recipient.trim(), facility: facility.trim(), specialty: specialty.trim(), urgency, reason: reason.trim(), summary: summary.trim(), investigations: investigations.trim() || undefined, meds });
    } else if (type === "Prescription") {
      if (meds.length === 0) return setError("Choose at least one active prescription.");
      Object.assign(data, { meds, diagnosis: diagnosis.trim() || undefined, remarks: remarks.trim() || undefined });
    } else {
      if (!adm) return setError("This patient has no discharged admission to summarise.");
      if (!diagnosis.trim()) return setError("Enter the diagnosis.");
      if (!course.trim()) return setError("Describe the hospital course and treatment.");
      if (followUpDate && followUpDate < today) return setError("The review date can't be in the past.");
      Object.assign(data, {
        admissionId: adm.id, ward: adm.ward, admittedOn: adm.admittedOn, dischargedOn: adm.dischargedOn, outcome: adm.outcome ?? "Discharged",
        diagnosis: diagnosis.trim(), course: course.trim(), meds, followUp: followUp.trim() || undefined, followUpDate: followUpDate || undefined,
      });
    }

    const list = loadDocuments();
    const doc: IssuedDoc = {
      id: uid(),
      number: nextDocNumber(list, type),
      type,
      patientId: patient.id,
      patientName: patient.name,
      issuedAt: Date.now(),
      issuedBy: user?.name ?? "Unknown user",
      issuedRole: user?.roleName ?? "",
      data,
    };
    // TODO: POST /patients/:id/documents via a services/ call (the backend assigns the number and keeps it immutable)
    saveDocuments([...list, doc]);
    // The clinical content is never written to the audit log.
    logAudit({ action: "Create", module: "Documents", summary: `Issued ${type.toLowerCase()} ${doc.number} for ${patient.name} (${patient.id})` });
    onIssued(doc);
  };

  const medPicker = (label: string) => (
    <fieldset className="rounded-lg border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-700">{label}</legend>
      {rx.length === 0 ? (
        <p className="text-sm text-slate-400">No active prescriptions on this patient's chart.</p>
      ) : (
        <ul className="space-y-1">
          {rx.map((r) => (
            <li key={r.id}>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span>{r.drug} {r.dose} · {r.route} · {r.frequency} · {r.duration}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );

  return (
    <Modal title={`${type} · ${patient.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {type === "Sick note" && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Unfit from"><input type="date" className={inputClass} value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} /></Field>
              <Field label="Unfit to (inclusive)"><input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
              <div className="flex items-end gap-2 pb-2 text-sm text-slate-600">
                {daysBetween(from, to)} day{daysBetween(from, to) === 1 ? "" : "s"}
                <button type="button" onClick={() => setTo(addDaysISO(from, 2))} className="text-xs font-medium text-blue-600 hover:underline">3 days</button>
                <button type="button" onClick={() => setTo(addDaysISO(from, 6))} className="text-xs font-medium text-blue-600 hover:underline">1 week</button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={showDiagnosis} onChange={(e) => setShowDiagnosis(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" /> Show the diagnosis on the note (only if the patient agrees)
            </label>
            {showDiagnosis && <Field label="Diagnosis"><input className={inputClass} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>}
            <Field label="Remarks (optional)"><textarea className={inputClass} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Light duties on return" /></Field>
          </>
        )}

        {type === "Referral letter" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Refer to (doctor or department)"><input className={inputClass} value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Dr. A. Bello, Cardiology" /></Field>
              <Field label="Hospital / facility"><input className={inputClass} value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="e.g. Federal Medical Centre, Umuahia" /></Field>
              <Field label="Specialty (optional)"><input className={inputClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></Field>
              <Field label="Urgency">
                <select className={inputClass} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                  {URGENCY.map((u) => <option key={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Reason for referral"><textarea className={inputClass} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-600">Clinical summary</span>
                {latestNote && <button type="button" onClick={() => setSummary(latestNote.text.slice(0, 1500))} className="text-xs font-medium text-blue-600 hover:underline">Start from the latest {latestNote.category.toLowerCase()}</button>}
              </div>
              <textarea className={inputClass} rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} aria-label="Clinical summary" />
            </div>
            <Field label="Investigations and results (optional)"><textarea className={inputClass} rows={2} value={investigations} onChange={(e) => setInvestigations(e.target.value)} /></Field>
            {medPicker("Include current medication")}
          </>
        )}

        {type === "Prescription" && (
          <>
            {medPicker("Drugs to print")}
            <Field label="Diagnosis (optional)"><input className={inputClass} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
            <Field label="Advice (optional)"><textarea className={inputClass} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Drink plenty of fluids. Return if the fever persists." /></Field>
          </>
        )}

        {type === "Discharge summary" && (
          <>
            {discharged.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This patient has no discharged admission. Discharge the patient on the Admissions page first.</p>
            ) : (
              <>
                <Field label="Admission">
                  <select className={inputClass} value={adm?.id ?? ""} onChange={(e) => changeAdmission(e.target.value)}>
                    {discharged.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.ward} · {a.admittedOn} to {a.dischargedOn}</option>)}
                  </select>
                </Field>
                <Field label="Diagnosis"><input className={inputClass} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
                <Field label="Hospital course and treatment"><textarea className={inputClass} rows={5} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="What happened during the stay, what was done, and the condition on discharge" /></Field>
                {medPicker("Medication on discharge")}
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Follow-up instructions" className="sm:col-span-2"><input className={inputClass} value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. Return to clinic with results" /></Field>
                  <Field label="Review date (optional)"><input type="date" className={inputClass} value={followUpDate} min={today} onChange={(e) => setFollowUpDate(e.target.value)} /></Field>
                </div>
              </>
            )}
          </>
        )}

        {allergies && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Known allergies ({allergies}) will be printed on this document.</p>}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <p className="text-xs text-slate-400">Once issued, a document can't be edited or deleted. To correct it, issue a new one.</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={type === "Discharge summary" && discharged.length === 0} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Issue and preview</button>
        </div>
      </form>
    </Modal>
  );
}