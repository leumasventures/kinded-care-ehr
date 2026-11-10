import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Eye, GitMerge, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { logAudit } from "../services/audit";
import Modal from "../components/billing/Modal";
import PatientChart from "../components/patients/PatientChart";
import MergeDialog from "../components/patients/MergeDialog";
import PatientDocuments from "../components/documents/PatientDocuments";
import { balanceOf, formatDate, formatNaira, loadInvoices, statusOf, todayISO } from "../types/billing";
import { loadAppointments } from "../types/appointments";
import { loadAdmissions } from "../types/admissions";
import { loadLabOrders } from "../types/laboratory";
import { loadDispensing } from "../types/pharmacy";
import { loadRecords } from "../types/records";
import {
  BLOOD_GROUPS,
  GENOTYPES,
  PAYERS,
  RELATIONSHIPS,
  ageLabel,
  allergyList,
  findDuplicates,
  loadPatients,
  nextPatientId,
  savePatients,
  type BloodGroup,
  type Genotype,
  type Patient,
  type Payer,
} from "../types/patients";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function PatientForm({
  patient,
  patients,
  onSave,
  onClose,
}: {
  patient: Patient | null; // null = new registration
  patients: Patient[];
  onSave: (p: Patient) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(patient?.name ?? "");
  const [dob, setDob] = useState(patient?.dob ?? "");
  const [gender, setGender] = useState<"Male" | "Female">(patient?.gender ?? "Male");
  const [phone, setPhone] = useState(patient?.phone ?? "");
  const [address, setAddress] = useState(patient?.address ?? "");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(patient?.bloodGroup ?? "Unknown");
  const [genotype, setGenotype] = useState<Genotype>(patient?.genotype ?? "Unknown");
  const [payer, setPayer] = useState<Payer>(patient?.payer ?? "Self-pay");
  const [payerName, setPayerName] = useState(patient?.payerName ?? "");
  const [memberId, setMemberId] = useState(patient?.memberId ?? "");
  const [allergies, setAllergies] = useState(patient?.allergies ?? "");
  const [kinName, setKinName] = useState(patient?.kinName ?? "");
  const [kinRelation, setKinRelation] = useState(patient?.kinRelation ?? RELATIONSHIPS[0]);
  const [kinPhone, setKinPhone] = useState(patient?.kinPhone ?? "");
  const [notes, setNotes] = useState(patient?.notes ?? "");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Full name is required.");
    if (!dob) return setError("Date of birth is required.");
    if (dob > todayISO()) return setError("Date of birth can't be in the future.");
    if (patients.some((x) => x.id !== patient?.id && same(x.name, name) && x.dob === dob))
      return setError("A patient with this name and date of birth is already registered.");
    if (payer !== "Self-pay" && !payerName.trim()) return setError("Enter the insurer or HMO name for this payer, or choose Self-pay.");
    const samePhone = findDuplicates(patients, { name: "", dob: "", phone }, patient?.id).find((x) => !same(x.name, name));
    if (samePhone && !window.confirm(`${samePhone.name} (${samePhone.id}) is already registered with this phone number. Register ${name.trim()} as a separate patient?`)) return;
    // TODO: POST/PUT /patients via a services/ call
    onSave({
      ...patient,
      id: patient?.id ?? nextPatientId(patients),
      name: name.trim(),
      dob,
      gender,
      phone: phone.trim(),
      address: address.trim(),
      bloodGroup,
      genotype,
      payer,
      payerName: payer === "Self-pay" ? undefined : payerName.trim(),
      memberId: payer === "Self-pay" ? undefined : memberId.trim() || undefined,
      allergies: allergies.trim(),
      kinName: kinName.trim(),
      kinRelation,
      kinPhone: kinPhone.trim(),
      notes: notes.trim() || undefined,
      registeredOn: patient?.registeredOn ?? todayISO(),
    });
  };

  return (
    <Modal title={patient ? `Edit ${patient.name}` : "Register Patient"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Full name" className="sm:col-span-3">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Date of birth">
            <input type="date" className={inputClass} value={dob} max={todayISO()} onChange={(e) => setDob(e.target.value)} />
          </Field>
          <Field label="Gender">
            <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value as "Male" | "Female")}>
              <option>Male</option>
              <option>Female</option>
            </select>
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Address" className="sm:col-span-3">
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Blood group">
            <select className={inputClass} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
              {BLOOD_GROUPS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="Genotype">
            <select className={inputClass} value={genotype} onChange={(e) => setGenotype(e.target.value as Genotype)}>
              {GENOTYPES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Payer">
            <select className={inputClass} value={payer} onChange={(e) => setPayer(e.target.value as Payer)}>
              {PAYERS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          {payer !== "Self-pay" && (
            <>
              <Field label="Insurer / HMO / company name" className="sm:col-span-2">
                <input className={inputClass} value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="e.g. Hygeia HMO, NHIA, Shell Nigeria" />
              </Field>
              <Field label="Member / enrolment no.">
                <input className={inputClass} value={memberId} onChange={(e) => setMemberId(e.target.value)} />
              </Field>
            </>
          )}
          <Field label="Known allergies (comma separated, blank if none)" className="sm:col-span-3">
            <input className={inputClass} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. Penicillin, Eggs" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Next of kin">
            <input className={inputClass} value={kinName} onChange={(e) => setKinName(e.target.value)} />
          </Field>
          <Field label="Relationship">
            <select className={inputClass} value={kinRelation} onChange={(e) => setKinRelation(e.target.value)}>
              {RELATIONSHIPS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Kin phone">
            <input className={inputClass} value={kinPhone} onChange={(e) => setKinPhone(e.target.value)} />
          </Field>
          <Field label="Notes (optional)" className="sm:col-span-3">
            <textarea rows={2} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {patient ? "Save Changes" : "Register"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function PatientDetail({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [tab, setTab] = useState<"overview" | "notes" | "medications" | "documents">("overview");
  useEffect(() => {
    logAudit({ action: "View", module: "Patients", summary: `Opened record of ${patient.name} (${patient.id})` });
  }, [patient.id, patient.name]);
  const mine = <T extends { patient: string; patientId?: string }>(rows: T[]) => rows.filter((r) => (r.patientId ? r.patientId === patient.id : same(r.patient, patient.name)));
  const appts = mine(loadAppointments()).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const admissions = mine(loadAdmissions());
  const labs = mine(loadLabOrders());
  const invoices = mine(loadInvoices());
  const rx = mine(loadDispensing());
  const owing = invoices.reduce((s, i) => s + balanceOf(i), 0);
  const allergies = allergyList(patient);

  return (
    <Modal title={`${patient.name} · ${patient.id}`} onClose={onClose} wide>
      <div className="space-y-5">
        {allergies.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            <AlertTriangle size={16} /> Allergies: <span className="font-semibold">{allergies.join(", ")}</span>
          </div>
        )}

        <div role="tablist" className="flex gap-1 border-b border-slate-200">
          {(["overview", "notes", "medications", "documents"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t === "notes" ? "Clinical notes" : t === "medications" ? "Medications" : t === "documents" ? "Documents" : "Overview"}
            </button>
          ))}
        </div>

        {(tab === "notes" || tab === "medications") && <PatientChart patient={patient} tab={tab} />}
        {tab === "documents" && <PatientDocuments patient={patient} />}

        {tab === "overview" && (
          <>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="Age / gender" value={`${ageLabel(patient.dob)} · ${patient.gender}`} />
          <Detail label="Date of birth" value={formatDate(patient.dob)} />
          <Detail label="Phone" value={patient.phone} />
          <Detail label="Blood group / genotype" value={`${patient.bloodGroup} · ${patient.genotype}`} />
          <Detail label="Payer" value={patient.payer === "Self-pay" ? "Self-pay" : `${patient.payer}${patient.payerName ? ` · ${patient.payerName}` : ""}${patient.memberId ? ` (${patient.memberId})` : ""}`} />
          <Detail label="Registered" value={formatDate(patient.registeredOn)} />
          <Detail label="Address" value={patient.address} />
          <Detail label="Next of kin" value={patient.kinName ? `${patient.kinName} (${patient.kinRelation})` : ""} />
          <Detail label="Kin phone" value={patient.kinPhone} />
        </dl>
        {patient.notes && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{patient.notes}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-slate-200">
            <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Appointments ({appts.length})</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {appts.slice(0, 4).map((a) => (
                <li key={a.id} className="flex justify-between gap-3 px-4 py-2">
                  <span className="text-slate-700">{formatDate(a.date)} · {a.doctor}</span>
                  <span className="text-slate-500">{a.status}</span>
                </li>
              ))}
              {appts.length === 0 && <li className="px-4 py-3 text-slate-400">None on record.</li>}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200">
            <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Admissions ({admissions.length})</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {admissions.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 px-4 py-2">
                  <span className="text-slate-700">{a.ward} · {a.bed} — {a.diagnosis}</span>
                  <span className={a.status === "Admitted" ? "font-medium text-blue-600" : "text-slate-500"}>{a.status}</span>
                </li>
              ))}
              {admissions.length === 0 && <li className="px-4 py-3 text-slate-400">None on record.</li>}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200">
            <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Lab orders ({labs.length})</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {labs.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 px-4 py-2">
                  <span className="text-slate-700">{l.tests.map((t) => t.name).join(", ")}</span>
                  <span className="shrink-0 text-slate-500">{l.status}</span>
                </li>
              ))}
              {labs.length === 0 && <li className="px-4 py-3 text-slate-400">None on record.</li>}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200">
            <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Billing &amp; pharmacy</h3>
            <ul className="divide-y divide-slate-100 text-sm">
              {invoices.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 px-4 py-2">
                  <span className="text-slate-700">{i.number}</span>
                  <span className="text-slate-500">{statusOf(i)} · {formatNaira(balanceOf(i))} due</span>
                </li>
              ))}
              {rx.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 px-4 py-2">
                  <span className="text-slate-700">{r.id} dispensed</span>
                  <span className="text-slate-500">{formatNaira(r.total)}</span>
                </li>
              ))}
              {invoices.length === 0 && rx.length === 0 && <li className="px-4 py-3 text-slate-400">Nothing on record.</li>}
            </ul>
            {owing > 0 && <p className="border-t border-slate-100 px-4 py-2 text-sm font-medium text-rose-600">Outstanding: {formatNaira(owing)}</p>}
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-2 text-sm">
          <Link to="/appointments" className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">Book appointment</Link>
          <Link to="/billing" className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50">Billing</Link>
        </div>
          </>
        )}
      </div>
    </Modal>
  );
}

type ModalState = { type: "new" } | { type: "edit"; id: string } | { type: "view"; id: string } | { type: "merge"; id: string } | null;

export default function Patients() {
  const { can, user } = useAuth();
  const [notice, setNotice] = useState("");
  const [patients, setPatients] = useState<Patient[]>(loadPatients);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<"all" | "Male" | "Female">("all");
  const [payer, setPayer] = useState<"all" | Payer>("all");
  const [allergyOnly, setAllergyOnly] = useState(false);
  // Other pages link here with ?open=P-1001 to show a patient's chart.
  const openId = params.get("open");
  const [modal, setModal] = useState<ModalState>(() => (openId ? { type: "view", id: openId } : null));
  const closeModal = () => {
    setModal(null);
    if (params.has("open")) setParams({}, { replace: true });
  };

  const admittedNames = useMemo(() => new Set(loadAdmissions().filter((a) => a.status === "Admitted").map((a) => a.patient.toLowerCase())), []);
  const lastVisit = (p: Patient) => {
    const dates = loadAppointments().filter((a) => same(a.patient, p.name) && a.status === "Completed").map((a) => a.date).sort();
    return dates.length ? dates[dates.length - 1] : undefined;
  };

  const monthPrefix = todayISO().slice(0, 7);
  const stats = [
    { label: "Registered patients", value: patients.length },
    { label: "New this month", value: patients.filter((p) => p.registeredOn.startsWith(monthPrefix)).length },
    { label: "Currently admitted", value: patients.filter((p) => admittedNames.has(p.name.toLowerCase())).length },
    { label: "With known allergies", value: patients.filter((p) => allergyList(p).length > 0).length },
  ];

  const rows = patients
    .filter((p) => gender === "all" || p.gender === gender)
    .filter((p) => payer === "all" || p.payer === payer)
    .filter((p) => !allergyOnly || allergyList(p).length > 0)
    .filter((p) => {
      const q = query.trim().toLowerCase();
      return !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
    })
    .sort((a, b) => b.id.localeCompare(a.id));

  const target = modal && modal.type !== "new" ? patients.find((p) => p.id === modal.id) : undefined;

  const save = (p: Patient) => {
    const isNew = !patients.some((x) => x.id === p.id);
    logAudit({ action: isNew ? "Create" : "Update", module: "Patients", summary: `${isNew ? "Registered" : "Updated details of"} ${p.name} (${p.id})` });
    const next = patients.some((x) => x.id === p.id) ? patients.map((x) => (x.id === p.id ? p : x)) : [p, ...patients];
    setPatients(next);
    savePatients(next); // TODO: POST/PUT /patients via a services/ call
    closeModal();
  };

  const remove = (p: Patient) => {
    if (admittedNames.has(p.name.toLowerCase())) return window.alert(`${p.name} is currently admitted and can't be deleted.`);
    const rec = loadRecords();
    if (rec.notes.some((n) => n.patientId === p.id) || rec.prescriptions.some((r) => r.patientId === p.id))
      return window.alert(`${p.name} has clinical notes or prescriptions on file. Clinical records are kept, so this patient can't be deleted.`);
    if (window.confirm(`Delete ${p.name} (${p.id})? This can't be undone.`)) {
      logAudit({ action: "Delete", module: "Patients", summary: `Deleted patient ${p.name} (${p.id})` });
      const next = patients.filter((x) => x.id !== p.id);
      setPatients(next);
      savePatients(next);
    }
  };

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID or phone"
              className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select value={gender} onChange={(e) => setGender(e.target.value as "all" | "Male" | "Female")} aria-label="Filter by gender" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All genders</option>
            <option>Male</option>
            <option>Female</option>
          </select>
          <select value={payer} onChange={(e) => setPayer(e.target.value as "all" | Payer)} aria-label="Filter by payer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All payers</option>
            {PAYERS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={allergyOnly} onChange={(e) => setAllergyOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
            Has allergies
          </label>
        </div>
        {can("Patients", "create") && (
          <button onClick={() => setModal({ type: "new" })} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Patient
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Patient</th>
              <th className="px-5 py-3">Age / sex</th>
              <th className="px-5 py-3">Blood · genotype</th>
              <th className="px-5 py-3">Payer</th>
              <th className="px-5 py-3">Allergies</th>
              <th className="px-5 py-3">Last visit</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((p) => {
              const lv = lastVisit(p);
              const allergies = allergyList(p);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-blue-600">{p.id}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setModal({ type: "view", id: p.id })} className="text-left font-medium text-slate-800 hover:text-blue-600">
                      {p.name}
                    </button>
                    {admittedNames.has(p.name.toLowerCase()) && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">Admitted</span>}
                    <p className="text-xs text-slate-500">{p.phone || "No phone"}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{ageLabel(p.dob)} · {p.gender}</td>
                  <td className="px-5 py-3 text-slate-600">{p.bloodGroup} · {p.genotype}</td>
                  <td className="px-5 py-3 text-slate-600">{p.payer}</td>
                  <td className="px-5 py-3">
                    {allergies.length > 0 ? (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700" title={allergies.join(", ")}>
                        {allergies.length > 1 ? `${allergies[0]} +${allergies.length - 1}` : allergies[0]}
                      </span>
                    ) : (
                      <span className="text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{lv ? formatDate(lv) : "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ type: "view", id: p.id })} title="View" aria-label={`View ${p.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                        <Eye size={16} />
                      </button>
                      {can("Patients", "edit") && (
                        <button onClick={() => setModal({ type: "edit", id: p.id })} title="Edit" aria-label={`Edit ${p.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {user?.isAdmin && (
                        <button onClick={() => setModal({ type: "merge", id: p.id })} title="Merge duplicate" aria-label={`Merge a duplicate of ${p.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-600">
                          <GitMerge size={15} />
                        </button>
                      )}
                      {can("Patients", "delete") && (
                        <button onClick={() => remove(p)} title="Delete" aria-label={`Delete ${p.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === "new" && <PatientForm patient={null} patients={patients} onSave={save} onClose={() => closeModal()} />}
      {modal?.type === "edit" && target && <PatientForm patient={target} patients={patients} onSave={save} onClose={() => closeModal()} />}
      {modal?.type === "merge" && target && (
        <MergeDialog
          patient={target}
          onClose={closeModal}
          onDone={(m) => {
            setPatients(loadPatients());
            closeModal();
            setNotice(m);
            window.setTimeout(() => setNotice(""), 6000);
          }}
        />
      )}
      {modal?.type === "view" && target && <PatientDetail patient={target} onClose={() => closeModal()} />}
    </div>
  );
}