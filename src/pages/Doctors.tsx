import { useState, type FormEvent, type ReactNode } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { STORE_KEYS, usePersisted } from "../services/store";
import Modal from "../components/billing/Modal";
import { formatDate, todayISO } from "../types/billing";
import { SLOTS, fmtTime, isActive, nowHHmm, loadAppointments } from "../types/appointments";
import { loadAdmissions } from "../types/admissions";
import {
  DAY_LABELS,
  DOCTOR_STATUSES,
  SPECIALTIES,
  nextDoctorId,
  scheduleLabel,
  seedDoctors,
  worksToday,
  type Doctor,
  type DoctorStatus,
} from "../types/doctors";

const statusStyle: Record<DoctorStatus, string> = {
  Available: "bg-emerald-50 text-emerald-700",
  "In Surgery": "bg-amber-50 text-amber-700",
  "On Leave": "bg-slate-100 text-slate-600",
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function DoctorForm({ doctor, doctors, onSave, onClose }: { doctor: Doctor | null; doctors: Doctor[]; onSave: (d: Doctor) => void; onClose: () => void }) {
  const [name, setName] = useState(doctor?.name ?? "Dr. ");
  const [specialty, setSpecialty] = useState(doctor?.specialty ?? SPECIALTIES[0]);
  const [phone, setPhone] = useState(doctor?.phone ?? "");
  const [email, setEmail] = useState(doctor?.email ?? "");
  const [days, setDays] = useState<number[]>(doctor?.days ?? [1, 2, 3, 4, 5]);
  const [start, setStart] = useState(doctor?.start ?? "08:00");
  const [end, setEnd] = useState(doctor?.end ?? "16:00");
  const [status, setStatus] = useState<DoctorStatus>(doctor?.status ?? "Available");
  const [error, setError] = useState("");

  const toggleDay = (i: number) => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 5) return setError("Enter the doctor's name, e.g. Dr. Okafor.");
    if (doctors.some((d) => d.id !== doctor?.id && d.name.toLowerCase() === n.toLowerCase())) return setError("A doctor with that name already exists.");
    if (days.length === 0) return setError("Choose at least one working day.");
    if (end <= start) return setError("End time must be after the start time.");
    // TODO: POST/PUT /doctors via a services/ call
    onSave({ id: doctor?.id ?? nextDoctorId(doctors), name: n, specialty, phone: phone.trim(), email: email.trim(), days, start, end, status });
  };

  return (
    <Modal title={doctor ? `Edit ${doctor.name}` : "Add Doctor"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label="Specialty">
            <select className={inputClass} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              {SPECIALTIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <div>
          <span className="mb-1 block text-sm text-slate-600">Working days</span>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                aria-pressed={days.includes(i)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${days.includes(i) ? "bg-blue-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Start">
            <input type="time" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End">
            <input type="time" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as DoctorStatus)}>
              {DOCTOR_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">{doctor ? "Save" : "Add Doctor"}</button>
        </div>
      </form>
    </Modal>
  );
}

type ModalState = { type: "new" } | { type: "edit"; id: string } | { type: "view"; id: string } | null;

export default function Doctors() {
  const { can } = useAuth();
  const [doctors, setDoctors] = usePersisted<Doctor[]>(STORE_KEYS.doctors, () => seedDoctors);
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [status, setStatus] = useState<"all" | DoctorStatus>("all");
  const [modal, setModal] = useState<ModalState>(null);

  const today = todayISO();
  const now = nowHHmm();

  const todayAppts = (d: Doctor) =>
    loadAppointments().filter((a) => a.doctor === d.name && a.date === today && isActive(a.status)).sort((a, b) => a.time.localeCompare(b.time));
  const capacity = (d: Doctor) => SLOTS.filter((t) => t >= d.start && t < d.end).length;
  const admitted = (d: Doctor) => loadAdmissions().filter((a) => a.doctor === d.name && a.status === "Admitted");
  const upcomingCount = (d: Doctor) => loadAppointments().filter((a) => a.doctor === d.name && a.date >= today && a.status === "Scheduled").length;

  const stats = [
    { label: "Doctors", value: doctors.length },
    { label: "Available today", value: doctors.filter((d) => d.status === "Available" && worksToday(d)).length },
    { label: "In surgery", value: doctors.filter((d) => d.status === "In Surgery").length },
    { label: "On leave", value: doctors.filter((d) => d.status === "On Leave").length },
    { label: "Appointments today", value: doctors.reduce((s, d) => s + todayAppts(d).length, 0) },
  ];

  const rows = doctors
    .filter((d) => specialty === "all" || d.specialty === specialty)
    .filter((d) => status === "all" || d.status === status)
    .filter((d) => {
      const q = query.trim().toLowerCase();
      return !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q);
    });

  const target = modal && modal.type !== "new" ? doctors.find((d) => d.id === modal.id) : undefined;

  const save = (d: Doctor) => {
    setDoctors((prev) => (prev.some((x) => x.id === d.id) ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d]));
    setModal(null);
  };

  const setDoctorStatus = (id: string, s: DoctorStatus) => setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, status: s } : d)));

  const remove = (d: Doctor) => {
    const open = upcomingCount(d) + admitted(d).length;
    if (open > 0) return window.alert(`${d.name} still has ${open} upcoming appointment(s) or admitted patient(s). Reassign them first, or set the doctor On Leave instead.`);
    if (window.confirm(`Remove ${d.name}?`)) setDoctors((prev) => prev.filter((x) => x.id !== d.id));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
              placeholder="Search by name or specialty"
              className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label="Filter by specialty" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All specialties</option>
            {SPECIALTIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as "all" | DoctorStatus)} aria-label="Filter by status" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            {DOCTOR_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {can("Doctors", "create") && (
          <button onClick={() => setModal({ type: "new" })} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> Add Doctor
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((d) => {
          const appts = todayAppts(d);
          const cap = capacity(d);
          const pct = cap ? Math.min(100, Math.round((appts.length / cap) * 100)) : 0;
          const next = appts.find((a) => a.time >= now && (a.status === "Scheduled" || a.status === "Checked in"));
          const working = worksToday(d);
          return (
            <div key={d.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
                    {d.name.replace("Dr. ", "").charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{d.name}</p>
                    <p className="text-sm text-slate-500">{d.specialty}</p>
                  </div>
                </div>
                {can("Doctors", "edit") ? (
                  <select
                    value={d.status}
                    onChange={(e) => setDoctorStatus(d.id, e.target.value as DoctorStatus)}
                    aria-label={`Status for ${d.name}`}
                    className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${statusStyle[d.status]}`}
                  >
                    {DOCTOR_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[d.status]}`}>{d.status}</span>
                )}
              </div>

              <div className="mt-4 flex gap-1" aria-label="Working days">
                {DAY_LABELS.map((label, i) => (
                  <span
                    key={label}
                    title={label}
                    className={`flex h-6 w-8 items-center justify-center rounded text-[10px] font-medium ${
                      d.days.includes(i) ? (i === new Date().getDay() ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700") : "bg-slate-50 text-slate-300"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {scheduleLabel(d)} · {working ? "working today" : "off today"}
              </p>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Today's appointments</span>
                  <span>{appts.length} of {cap} slots</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className={`h-1.5 rounded-full ${pct > 85 ? "bg-rose-500" : "bg-blue-600"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Next patient</dt>
                  <dd className="text-right text-slate-700">{next ? `${next.patient}, ${fmtTime(next.time)}` : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Admitted patients</dt>
                  <dd className="text-slate-700">{admitted(d).length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="text-slate-700">{d.phone || "—"}</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-medium text-blue-600">{d.id}</span>
                <div className="flex gap-1">
                  <button onClick={() => setModal({ type: "view", id: d.id })} title="View" aria-label={`View ${d.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                    <Eye size={16} />
                  </button>
                  {can("Doctors", "edit") && (
                    <button onClick={() => setModal({ type: "edit", id: d.id })} title="Edit" aria-label={`Edit ${d.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600">
                      <Pencil size={15} />
                    </button>
                  )}
                  {can("Doctors", "delete") && (
                    <button onClick={() => remove(d)} title="Remove" aria-label={`Remove ${d.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && <p className="col-span-full py-10 text-center text-sm text-slate-400">No doctors found.</p>}
      </div>

      <p className="text-xs text-slate-400">
        Appointment and admission figures come from the Appointments and Admissions data. Doctors added here are not yet offered in booking forms until a shared doctor list is connected to the backend.
      </p>

      {modal?.type === "new" && <DoctorForm doctor={null} doctors={doctors} onSave={save} onClose={() => setModal(null)} />}
      {modal?.type === "edit" && target && <DoctorForm doctor={target} doctors={doctors} onSave={save} onClose={() => setModal(null)} />}

      {modal?.type === "view" && target && (
        <Modal title={`${target.name} · ${target.specialty}`} onClose={() => setModal(null)} wide>
          <div className="space-y-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div><dt className="text-xs uppercase text-slate-400">Phone</dt><dd className="text-slate-800">{target.phone || "—"}</dd></div>
              <div><dt className="text-xs uppercase text-slate-400">Email</dt><dd className="text-slate-800">{target.email || "—"}</dd></div>
              <div><dt className="text-xs uppercase text-slate-400">Hours</dt><dd className="text-slate-800">{target.days.map((i) => DAY_LABELS[i]).join(", ")} · {scheduleLabel(target)}</dd></div>
            </dl>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-lg border border-slate-200">
                <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Today's schedule</h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {todayAppts(target).map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 px-4 py-2">
                      <span className="text-slate-700">{fmtTime(a.time)} · {a.patient}</span>
                      <span className="text-slate-500">{a.status}</span>
                    </li>
                  ))}
                  {todayAppts(target).length === 0 && <li className="px-4 py-3 text-slate-400">No appointments today.</li>}
                </ul>
              </section>

              <section className="rounded-lg border border-slate-200">
                <h3 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Admitted patients</h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {admitted(target).map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 px-4 py-2">
                      <span className="text-slate-700">{a.patient} · {a.bed}</span>
                      <span className="text-slate-500">{formatDate(a.admittedOn)}</span>
                    </li>
                  ))}
                  {admitted(target).length === 0 && <li className="px-4 py-3 text-slate-400">No admitted patients.</li>}
                </ul>
              </section>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}