import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";
import { patientsApi, type PatientInput, type PatientListItem, type PatientStats, type PatientSummary } from "../services/patients";
import Modal from "../components/billing/Modal";
import PatientChart from "../components/patients/PatientChart";
import PatientDocuments from "../components/documents/PatientDocuments";
import { formatDate, formatNaira, todayISO } from "../types/billing";
import {
  BLOOD_GROUPS,
  GENOTYPES,
  PAYERS,
  RELATIONSHIPS,
  ageLabel,
  allergyList,
  type BloodGroup,
  type Genotype,
  type Patient,
  type Payer,
} from "../types/patients";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const PAGE_SIZE = 25;

const failure = (e: unknown) => (e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection and try again.");

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

type SaveResult = { ok: true } | { error: string } | { duplicates: Patient[] };

function PatientForm({
  patient,
  onSave,
  onClose,
}: {
  patient: Patient | null; // null = new registration
  onSave: (data: PatientInput, allowDuplicate: boolean) => Promise<SaveResult>;
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
  const [kinRelation, setKinRelation] = useState<string>(patient?.kinRelation ?? RELATIONSHIPS[0]);
  const [kinPhone, setKinPhone] = useState(patient?.kinPhone ?? "");
  const [notes, setNotes] = useState(patient?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Patient[] | null>(null);

  const send = async (allowDuplicate: boolean) => {
    setError("");
    if (!name.trim()) return setError("Full name is required.");
    if (!dob) return setError("Date of birth is required.");
    if (dob > todayISO()) return setError("Date of birth can't be in the future.");
    if (payer !== "Self-pay" && !payerName.trim()) return setError("Enter the insurer or HMO name for this payer, or choose Self-pay.");

    setSaving(true);
    const result = await onSave(
      {
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
      },
      allowDuplicate
    );
    setSaving(false);
    if ("error" in result) setError(result.error);
    else if ("duplicates" in result) setDuplicates(result.duplicates);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(false);
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

        {duplicates && (
          <div role="alert" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">This person may already be registered:</p>
            <ul className="space-y-0.5">
              {duplicates.map((d) => (
                <li key={d.id}>
                  {d.name} ({d.id}) · born {formatDate(d.dob)}
                  {d.phone ? ` · ${d.phone}` : ""}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => void send(true)} className="rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-60">
                {patient ? "Save anyway" : "Register as a new patient"}
              </button>
              <button type="button" onClick={() => setDuplicates(null)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-100">
                Go back
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200">
      <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

const rowClass = "flex justify-between gap-3 px-4 py-2";
const emptyRow = (text: string) => <li className="px-4 py-3 text-slate-400">{text}</li>;

function PatientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [tab, setTab] = useState<"overview" | "notes" | "medications" | "documents">("overview");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stale = false;
    // Opening the record is audited by the server when it is fetched.
    patientsApi
      .get(id)
      .then((r) => !stale && setPatient(r.patient))
      .catch((e) => !stale && setError(failure(e)));
    patientsApi
      .summary(id)
      .then((r) => !stale && setSummary(r.summary))
      .catch(() => !stale && setSummary({}));
    return () => {
      stale = true;
    };
  }, [id]);

  if (error)
    return (
      <Modal title="Patient record" onClose={onClose}>
        <p role="alert" className="text-sm text-rose-600">{error}</p>
      </Modal>
    );
  if (!patient)
    return (
      <Modal title="Patient record" onClose={onClose}>
        <p className="text-sm text-slate-500">Loading the record…</p>
      </Modal>
    );

  const allergies = allergyList(patient);
  const owing = (summary?.invoices ?? []).reduce((s, i) => s + i.balance, 0);

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

        {(tab === "notes" || tab === "medications" || tab === "documents") && (
          <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Notes, medications and documents are still saved in this browser only. They move to the database when those pages are connected.
          </p>
        )}
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

            {summary === null ? (
              <p className="text-sm text-slate-500">Loading the rest of the chart…</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {summary.appointments && (
                  <Section title={`Appointments (${summary.appointments.length})`}>
                    <ul className="divide-y divide-slate-100 text-sm">
                      {summary.appointments.slice(0, 4).map((a) => (
                        <li key={a.id} className={rowClass}>
                          <span className="text-slate-700">{formatDate(a.date)} · {a.doctor}</span>
                          <span className="text-slate-500">{a.status}</span>
                        </li>
                      ))}
                      {summary.appointments.length === 0 && emptyRow("None on record.")}
                    </ul>
                  </Section>
                )}

                {summary.admissions && (
                  <Section title={`Admissions (${summary.admissions.length})`}>
                    <ul className="divide-y divide-slate-100 text-sm">
                      {summary.admissions.map((a) => (
                        <li key={a.id} className={rowClass}>
                          <span className="text-slate-700">
                            {[a.ward, a.bed].filter(Boolean).join(" · ") || "No bed"} · {formatDate(a.admittedAt.slice(0, 10))}
                          </span>
                          <span className={a.status === "Admitted" ? "font-medium text-blue-600" : "text-slate-500"}>{a.status}</span>
                        </li>
                      ))}
                      {summary.admissions.length === 0 && emptyRow("None on record.")}
                    </ul>
                  </Section>
                )}

                {summary.labOrders && (
                  <Section title={`Lab orders (${summary.labOrders.length})`}>
                    <ul className="divide-y divide-slate-100 text-sm">
                      {summary.labOrders.map((l) => (
                        <li key={l.id} className={rowClass}>
                          <span className="text-slate-700">{l.tests.map((t) => t.name).join(", ")}</span>
                          <span className="shrink-0 text-slate-500">{l.status}</span>
                        </li>
                      ))}
                      {summary.labOrders.length === 0 && emptyRow("None on record.")}
                    </ul>
                  </Section>
                )}

                {(summary.invoices || summary.prescriptions) && (
                  <Section title="Billing & pharmacy">
                    <ul className="divide-y divide-slate-100 text-sm">
                      {(summary.invoices ?? []).map((i) => (
                        <li key={i.id} className={rowClass}>
                          <span className="text-slate-700">{i.number}</span>
                          <span className="text-slate-500">{i.status} · {formatNaira(i.balance)} due</span>
                        </li>
                      ))}
                      {(summary.prescriptions ?? []).map((r) => (
                        <li key={r.id} className={rowClass}>
                          <span className="text-slate-700">{r.id} · {r.drug}</span>
                          <span className="text-slate-500">{r.status}</span>
                        </li>
                      ))}
                      {(summary.invoices ?? []).length === 0 && (summary.prescriptions ?? []).length === 0 && emptyRow("Nothing on record.")}
                    </ul>
                    {owing > 0 && <p className="border-t border-slate-100 px-4 py-2 text-sm font-medium text-rose-600">Outstanding: {formatNaira(owing)}</p>}
                  </Section>
                )}
              </div>
            )}

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

type ModalState = { type: "new" } | { type: "edit"; patient: PatientListItem } | { type: "view"; id: string } | null;

export default function Patients() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<PatientListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<PatientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState(""); // the query, once typing has paused
  const [gender, setGender] = useState<"all" | "Male" | "Female">("all");
  const [payer, setPayer] = useState<"all" | Payer>("all");
  const [allergyOnly, setAllergyOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | undefined>(undefined);
  // Other pages link here with ?open=P-1001 to show a patient's chart.
  const openId = params.get("open");
  const [modal, setModal] = useState<ModalState>(() => (openId ? { type: "view", id: openId } : null));

  const closeModal = () => {
    setModal(null);
    if (params.has("open")) setParams({}, { replace: true });
  };
  const refresh = () => setReloadKey((k) => k + 1);
  const flash = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 5000);
  };
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let stale = false;
    setLoadError("");
    patientsApi
      .list({
        search,
        gender: gender === "all" ? undefined : gender,
        payer: payer === "all" ? undefined : payer,
        hasAllergies: allergyOnly,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      .then((r) => {
        if (stale) return;
        setRows(r.patients);
        setTotal(r.total);
      })
      .catch((e) => !stale && setLoadError(failure(e)))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [search, gender, payer, allergyOnly, page, reloadKey]);

  useEffect(() => {
    patientsApi.stats().then(setStats).catch(() => undefined); // the tiles are a convenience: the list still works without them
  }, [reloadKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const save = async (data: PatientInput, allowDuplicate: boolean): Promise<SaveResult> => {
    try {
      if (modal?.type === "edit") {
        await patientsApi.update(modal.patient.id, data, allowDuplicate);
        flash(`${data.name} updated.`);
      } else {
        await patientsApi.create(data, allowDuplicate);
        flash(`${data.name} registered.`);
      }
      refresh();
      closeModal();
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError && e.code === "possible_duplicate" && Array.isArray(e.data.duplicates)) return { duplicates: e.data.duplicates as Patient[] };
      return { error: failure(e) };
    }
  };

  // The server decides whether a patient can be deleted: patients with notes, appointments, invoices or ward, lab, pharmacy or nursing records are kept.
  const remove = async (p: PatientListItem) => {
    if (!window.confirm(`Delete ${p.name} (${p.id})? This can't be undone.`)) return;
    try {
      await patientsApi.remove(p.id);
      flash(`${p.name} deleted.`);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      refresh();
    } catch (e) {
      flash(failure(e));
    }
  };

  const tiles = [
    { label: "Registered patients", value: stats?.total },
    { label: "New this month", value: stats?.newThisMonth },
    { label: "Currently admitted", value: stats?.admitted },
    { label: "With known allergies", value: stats?.withAllergies },
  ];

  if (loading) return <p className="text-sm text-slate-500">Loading patients from the database…</p>;

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">{notice}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">{s.value ?? "—"}</p>
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
          <select
            value={gender}
            onChange={(e) => {
              setGender(e.target.value as "all" | "Male" | "Female");
              setPage(1);
            }}
            aria-label="Filter by gender"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All genders</option>
            <option>Male</option>
            <option>Female</option>
          </select>
          <select
            value={payer}
            onChange={(e) => {
              setPayer(e.target.value as "all" | Payer);
              setPage(1);
            }}
            aria-label="Filter by payer"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All payers</option>
            {PAYERS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={allergyOnly}
              onChange={(e) => {
                setAllergyOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Has allergies
          </label>
        </div>
        {can("Patients", "create") && (
          <button onClick={() => setModal({ type: "new" })} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Patient
          </button>
        )}
      </div>

      {loadError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p role="alert">{loadError}</p>
          <button onClick={refresh} className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            Try again
          </button>
        </div>
      )}

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
              const allergies = allergyList(p);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-blue-600">{p.id}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setModal({ type: "view", id: p.id })} className="text-left font-medium text-slate-800 hover:text-blue-600">
                      {p.name}
                    </button>
                    {p.admitted && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">Admitted</span>}
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
                  <td className="px-5 py-3 text-slate-600">{p.lastVisit ? formatDate(p.lastVisit) : "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ type: "view", id: p.id })} title="View" aria-label={`View ${p.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                        <Eye size={16} />
                      </button>
                      {can("Patients", "edit") && (
                        <button onClick={() => setModal({ type: "edit", patient: p })} title="Edit" aria-label={`Edit ${p.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600">
                          <Pencil size={15} />
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
            {rows.length === 0 && !loadError && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">
              Previous
            </button>
            <button disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}

      {modal?.type === "new" && <PatientForm patient={null} onSave={save} onClose={closeModal} />}
      {modal?.type === "edit" && <PatientForm patient={modal.patient} onSave={save} onClose={closeModal} />}
      {modal?.type === "view" && <PatientDetail id={modal.id} onClose={closeModal} />}
    </div>
  );
}