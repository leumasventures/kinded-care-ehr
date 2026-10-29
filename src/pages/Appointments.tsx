import { useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Pencil, Plus, Search, UserX, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/billing/Modal";
import { addDaysISO, formatNaira, todayISO } from "../types/billing";
import { loadPriceList } from "../types/pricing";
import { DOCTORS } from "../types/admissions";
import {
  SLOTS,
  STATUSES,
  VISIT_TYPES,
  fmtTime,
  isActive,
  isBooked,
  nextAppointmentId,
  nowHHmm,
  seedAppointments,
  type Appointment,
  type AppointmentStatus,
  type VisitType,
} from "../types/appointments";

const statusStyle: Record<AppointmentStatus, string> = {
  Scheduled: "bg-blue-50 text-blue-700",
  "Checked in": "bg-violet-50 text-violet-700",
  "In Progress": "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
  "No-show": "bg-slate-100 text-slate-600",
};

// The one-click "next step" for each status.
const nextStep: Partial<Record<AppointmentStatus, { label: string; to: AppointmentStatus }>> = {
  Scheduled: { label: "Check in", to: "Checked in" },
  "Checked in": { label: "Start", to: "In Progress" },
  "In Progress": { label: "Complete", to: "Completed" },
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function AppointmentForm({
  appointment,
  appointments,
  presetDate,
  fees,
  onSave,
  onClose,
}: {
  appointment: Appointment | null; // null = new booking
  appointments: Appointment[];
  presetDate: string;
  fees: Record<VisitType, number | undefined>;
  onSave: (a: Appointment) => void;
  onClose: () => void;
}) {
  const today = todayISO();
  const [patient, setPatient] = useState(appointment?.patient ?? "");
  const [phone, setPhone] = useState(appointment?.phone ?? "");
  const [doctor, setDoctor] = useState(appointment?.doctor ?? DOCTORS[0]);
  const [date, setDate] = useState(appointment?.date ?? (presetDate < today ? today : presetDate));
  const [chosenTime, setChosenTime] = useState(appointment?.time ?? "");
  const [type, setType] = useState<VisitType>(appointment?.type ?? VISIT_TYPES[0].name);
  const [reason, setReason] = useState(appointment?.reason ?? "");
  const [error, setError] = useState("");

  const slotOk = (t: string) =>
    !isBooked(appointments, doctor, date, t, appointment?.id) &&
    !(date === today && t < nowHHmm() && t !== appointment?.time);

  const freeSlots = SLOTS.filter(slotOk);
  const time = slotOk(chosenTime) && chosenTime ? chosenTime : freeSlots[0] ?? "";
  const fee = fees[type];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!patient.trim()) return setError("Patient name is required.");
    if (date < today) return setError("Choose today or a future date.");
    if (!time) return setError("No free slots for this doctor on that day. Pick another date or doctor.");
    if (isBooked(appointments, doctor, date, time, appointment?.id)) return setError("That slot has just been taken.");

    // TODO: POST/PUT /appointments via a services/ call
    onSave({
      id: appointment?.id ?? nextAppointmentId(appointments),
      patient: patient.trim(),
      phone: phone.trim() || undefined,
      doctor,
      date,
      time,
      type,
      reason: reason.trim() || undefined,
      status: appointment?.status ?? "Scheduled",
    });
  };

  return (
    <Modal title={appointment ? `Reschedule ${appointment.id}` : "Book Appointment"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Patient name</span>
            <input className={inputClass} value={patient} onChange={(e) => setPatient(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Phone (optional)</span>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Doctor</span>
            <select className={inputClass} value={doctor} onChange={(e) => setDoctor(e.target.value)}>
              {DOCTORS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Date</span>
            <input type="date" className={inputClass} value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Time</span>
            {freeSlots.length === 0 ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Fully booked.</p>
            ) : (
              <select className={inputClass} value={time} onChange={(e) => setChosenTime(e.target.value)}>
                {SLOTS.map((t) => (
                  <option key={t} value={t} disabled={!slotOk(t)}>
                    {fmtTime(t)}
                    {slotOk(t) ? "" : " (unavailable)"}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Visit type</span>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as VisitType)}>
              {VISIT_TYPES.map((v) => (
                <option key={v.name}>{v.name}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Reason for visit (optional)</span>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {fee !== undefined && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Consultation fee: <span className="font-medium text-slate-800">{formatNaira(fee)}</span> (from the Price List)
          </p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!time}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {appointment ? "Save" : "Book"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Appointments() {
  const { can } = useAuth();
  const today = todayISO();
  const [appointments, setAppointments] = useState<Appointment[]>(seedAppointments);
  const [scope, setScope] = useState<"day" | "upcoming" | "all">("day");
  const [date, setDate] = useState(today);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"book" | string | null>(null); // "book" or an appointment id

  // Consultation fees come from the Price List.
  const fees = useMemo(() => {
    const byName = new Map(loadPriceList().map((p) => [p.name.toLowerCase(), p.price]));
    return Object.fromEntries(VISIT_TYPES.map((v) => [v.name, byName.get(v.priceName.toLowerCase())])) as Record<VisitType, number | undefined>;
  }, []);

  const scoped = appointments
    .filter((a) => (scope === "day" ? a.date === date : scope === "upcoming" ? a.date >= today && isActive(a.status) : true))
    .filter((a) => doctorFilter === "all" || a.doctor === doctorFilter);

  const rows = scoped
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .filter((a) => {
      const q = query.trim().toLowerCase();
      return !q || a.patient.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || (a.phone ?? "").includes(q);
    })
    .sort((a, b) => {
      const cmp = `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
      return scope === "all" ? -cmp : cmp;
    });

  const count = (...s: AppointmentStatus[]) => scoped.filter((a) => s.includes(a.status)).length;
  const cards = [
    { label: "Total", value: scoped.length, tone: "text-slate-800" },
    { label: "Waiting", value: count("Scheduled", "Checked in"), tone: "text-blue-600" },
    { label: "In progress", value: count("In Progress"), tone: "text-amber-600" },
    { label: "Completed", value: count("Completed"), tone: "text-emerald-600" },
    { label: "Cancelled / no-show", value: count("Cancelled", "No-show"), tone: "text-rose-600" },
  ];

  const editing = modal && modal !== "book" ? appointments.find((a) => a.id === modal) : undefined;

  const setStatus = (id: string, status: AppointmentStatus) => {
    // TODO: PUT /appointments/:id/status via a services/ call
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const cancel = (a: Appointment) => {
    if (window.confirm(`Cancel ${a.patient}'s appointment on ${a.date} at ${fmtTime(a.time)}?`)) setStatus(a.id, "Cancelled");
  };

  const save = (a: Appointment) => {
    setAppointments((prev) => (prev.some((x) => x.id === a.id) ? prev.map((x) => (x.id === a.id ? a : x)) : [...prev, a]));
    setModal(null);
    if (scope === "day") setDate(a.date); // jump to the day just booked
  };

  const nowTime = nowHHmm();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ["day", "Day"],
                  ["upcoming", "Upcoming"],
                  ["all", "All"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setScope(id)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                    scope === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scope === "day" && (
              <div className="flex items-center gap-1">
                <button onClick={() => setDate(addDaysISO(date, -1))} aria-label="Previous day" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
                  <ChevronLeft size={18} />
                </button>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                  aria-label="Select date"
                />
                <button onClick={() => setDate(addDaysISO(date, 1))} aria-label="Next day" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
                  <ChevronRight size={18} />
                </button>
                {date !== today && (
                  <button onClick={() => setDate(today)} className="ml-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                    Today
                  </button>
                )}
              </div>
            )}
          </div>

          {can("Appointments", "create") && (
            <button
              onClick={() => setModal("book")}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Book Appointment
            </button>
          )}
        </div>

        {scope === "day" && <p className="text-sm font-medium text-slate-700">{longDate(date)}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient, ID or phone"
              className="w-64 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} aria-label="Filter by doctor" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="all">All doctors</option>
            {DOCTORS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | AppointmentStatus)}
            aria-label="Filter by status"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                {scope !== "day" && <th className="px-5 py-3">Date</th>}
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Doctor</th>
                <th className="px-5 py-3">Visit</th>
                <th className="px-5 py-3 text-right">Fee</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => {
                const step = nextStep[a.status];
                const late = a.status === "Scheduled" && a.date === today && a.time < nowTime;
                const fee = fees[a.type];
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{fmtTime(a.time)}</td>
                    {scope !== "day" && <td className="px-5 py-3 text-slate-600">{a.date}</td>}
                    <td className="px-5 py-3">
                      <p className="text-slate-800">{a.patient}</p>
                      <p className="text-xs text-slate-500">
                        <span className="text-blue-600">{a.id}</span>
                        {a.reason ? ` · ${a.reason}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.doctor}</td>
                    <td className="px-5 py-3 text-slate-600">{a.type}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{fee !== undefined ? formatNaira(fee) : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[a.status]}`}>{a.status}</span>
                      {late && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Late</span>}
                    </td>
                    <td className="px-5 py-3">
                      {can("Appointments", "edit") && (
                        <div className="flex items-center justify-end gap-1">
                          {step && (
                            <button
                              onClick={() => setStatus(a.id, step.to)}
                              className="flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <CalendarCheck size={13} /> {step.label}
                            </button>
                          )}
                          {isActive(a.status) && a.status !== "Completed" && (
                            <button onClick={() => setModal(a.id)} title="Reschedule" aria-label={`Reschedule ${a.patient}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                              <Pencil size={15} />
                            </button>
                          )}
                          {a.status === "Scheduled" && (
                            <button onClick={() => setStatus(a.id, "No-show")} title="Mark no-show" aria-label={`Mark ${a.patient} no-show`} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                              <UserX size={15} />
                            </button>
                          )}
                          {(a.status === "Scheduled" || a.status === "Checked in") && (
                            <button onClick={() => cancel(a)} title="Cancel" aria-label={`Cancel ${a.patient}'s appointment`} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                              <X size={15} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={scope === "day" ? 7 : 8} className="px-5 py-8 text-center text-slate-400">
                    No appointments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          Check in → Start → Complete moves a patient through the visit. Fees come from the Price List; add them to the patient's invoice in Billing.
        </p>
      </div>

      {modal === "book" && (
        <AppointmentForm appointment={null} appointments={appointments} presetDate={scope === "day" ? date : today} fees={fees} onSave={save} onClose={() => setModal(null)} />
      )}
      {editing && <AppointmentForm appointment={editing} appointments={appointments} presetDate={editing.date} fees={fees} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}