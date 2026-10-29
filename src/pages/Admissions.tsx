import { useMemo, useState, type FormEvent } from "react";
import { ArrowRightLeft, LogOut, Plus, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/billing/Modal";
import { formatDate, formatNaira, todayISO } from "../types/billing";
import { loadPriceList } from "../types/pricing";
import {
  DOCTORS,
  OUTCOMES,
  WARDS,
  WARD_NAMES,
  bedsOf,
  freeBeds,
  nextAdmissionId,
  seedAdmissions,
  stayDays,
  type Admission,
  type Outcome,
  type WardName,
} from "../types/admissions";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function BedSelect({
  ward,
  free,
  value,
  onChange,
}: {
  ward: WardName;
  free: string[];
  value: string;
  onChange: (bed: string) => void;
}) {
  return free.length === 0 ? (
    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">No free beds in {ward}.</p>
  ) : (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {free.map((b) => (
        <option key={b}>{b}</option>
      ))}
    </select>
  );
}

function ModalButtons({ onClose, label, disabled }: { onClose: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}

function AdmitForm({
  admissions,
  presetWard,
  presetBed,
  onSave,
  onClose,
}: {
  admissions: Admission[];
  presetWard?: WardName;
  presetBed?: string;
  onSave: (a: Admission) => void;
  onClose: () => void;
}) {
  const [patient, setPatient] = useState("");
  const [ward, setWard] = useState<WardName>(presetWard ?? WARD_NAMES[0]);
  const [chosenBed, setChosenBed] = useState(presetBed ?? "");
  const [doctor, setDoctor] = useState(DOCTORS[0]);
  const [diagnosis, setDiagnosis] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");

  const free = freeBeds(ward, admissions);
  const bed = free.includes(chosenBed) ? chosenBed : free[0] ?? "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!patient.trim()) return setError("Patient name is required.");
    if (!diagnosis.trim()) return setError("Enter the reason for admission / diagnosis.");
    if (!bed) return setError("Choose a free bed.");
    if (date > todayISO()) return setError("Admission date can't be in the future.");
    // TODO: POST /admissions via a services/ call
    onSave({
      id: nextAdmissionId(admissions),
      patient: patient.trim(),
      ward,
      bed,
      admittedOn: date,
      doctor,
      diagnosis: diagnosis.trim(),
      status: "Admitted",
    });
  };

  return (
    <Modal title="Admit Patient" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Patient name</span>
          <input className={inputClass} value={patient} onChange={(e) => setPatient(e.target.value)} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Ward</span>
            <select className={inputClass} value={ward} onChange={(e) => setWard(e.target.value as WardName)}>
              {WARD_NAMES.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Bed</span>
            <BedSelect ward={ward} free={free} value={bed} onChange={setChosenBed} />
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
            <span className="mb-1 block text-slate-600">Admission date</span>
            <input type="date" className={inputClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Reason for admission / diagnosis</span>
          <input className={inputClass} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <ModalButtons onClose={onClose} label="Admit" disabled={!bed} />
      </form>
    </Modal>
  );
}

function TransferForm({
  admission,
  admissions,
  onSave,
  onClose,
}: {
  admission: Admission;
  admissions: Admission[];
  onSave: (ward: WardName, bed: string) => void;
  onClose: () => void;
}) {
  const [ward, setWard] = useState<WardName>(admission.ward);
  const [chosenBed, setChosenBed] = useState("");

  const free = freeBeds(ward, admissions);
  const bed = free.includes(chosenBed) ? chosenBed : free[0] ?? "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (bed) onSave(ward, bed);
  };

  return (
    <Modal title={`Transfer ${admission.patient}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Currently in {admission.ward}, bed {admission.bed}.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">New ward</span>
            <select className={inputClass} value={ward} onChange={(e) => setWard(e.target.value as WardName)}>
              {WARD_NAMES.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">New bed</span>
            <BedSelect ward={ward} free={free} value={bed} onChange={setChosenBed} />
          </label>
        </div>
        <ModalButtons onClose={onClose} label="Transfer" disabled={!bed} />
      </form>
    </Modal>
  );
}

function DischargeForm({
  admission,
  rate,
  onSave,
  onClose,
}: {
  admission: Admission;
  rate?: number;
  onSave: (date: string, outcome: Outcome, notes: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [outcome, setOutcome] = useState<Outcome>(OUTCOMES[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const days = stayDays({ ...admission, dischargedOn: date });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (date < admission.admittedOn) return setError("Discharge date can't be before the admission date.");
    if (date > todayISO()) return setError("Discharge date can't be in the future.");
    onSave(date, outcome, notes.trim());
  };

  return (
    <Modal title={`Discharge ${admission.patient}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Discharge date</span>
            <input type="date" className={inputClass} value={date} min={admission.admittedOn} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Outcome</span>
            <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
              {OUTCOMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Discharge notes (optional)</span>
          <textarea rows={3} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Stay: <span className="font-medium text-slate-800">{days} day{days > 1 ? "s" : ""}</span>
          {rate !== undefined && (
            <>
              {" "}
              · Bed charges: <span className="font-medium text-slate-800">{formatNaira(days * rate)}</span> — add them to the patient's invoice in Billing.
            </>
          )}
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <ModalButtons onClose={onClose} label="Discharge" />
      </form>
    </Modal>
  );
}

type ModalState =
  | { type: "admit"; ward?: WardName; bed?: string }
  | { type: "transfer"; id: string }
  | { type: "discharge"; id: string }
  | null;

export default function Admissions() {
  const { can } = useAuth();
  const [admissions, setAdmissions] = useState<Admission[]>(seedAdmissions);
  const [tab, setTab] = useState<"current" | "discharged">("current");
  const [wardFilter, setWardFilter] = useState<"all" | WardName>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  // Daily bed rates come from the Price List.
  const rates = useMemo(() => {
    const byName = new Map(loadPriceList().map((p) => [p.name.toLowerCase(), p.price]));
    return Object.fromEntries(WARDS.map((w) => [w.name, byName.get(w.rateName.toLowerCase())])) as Record<WardName, number | undefined>;
  }, []);

  const current = admissions.filter((a) => a.status === "Admitted");

  const wardStats = WARDS.map((w) => {
    const occupied = current.filter((a) => a.ward === w.name).length;
    return { ...w, occupied, free: w.beds - occupied, pct: Math.round((occupied / w.beds) * 100) };
  });

  const rows = admissions
    .filter((a) => (tab === "current" ? a.status === "Admitted" : a.status === "Discharged"))
    .filter((a) => wardFilter === "all" || a.ward === wardFilter)
    .filter((a) => {
      const q = query.trim().toLowerCase();
      return !q || a.patient.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.bed.toLowerCase().includes(q);
    })
    .sort((a, b) =>
      tab === "current" ? b.admittedOn.localeCompare(a.admittedOn) : (b.dischargedOn ?? "").localeCompare(a.dischargedOn ?? "")
    );

  const mapWards = wardStats.filter((w) => wardFilter === "all" || w.name === wardFilter);
  const bedOccupant = (ward: WardName, bed: string) => current.find((a) => a.ward === ward && a.bed === bed);

  const transferring = modal?.type === "transfer" ? admissions.find((a) => a.id === modal.id) : undefined;
  const discharging = modal?.type === "discharge" ? admissions.find((a) => a.id === modal.id) : undefined;

  const admit = (a: Admission) => {
    setAdmissions((prev) => [a, ...prev]);
    setModal(null);
  };

  const transfer = (ward: WardName, bed: string) => {
    if (!transferring) return;
    // TODO: PUT /admissions/:id/transfer via a services/ call
    setAdmissions((prev) => prev.map((a) => (a.id === transferring.id ? { ...a, ward, bed } : a)));
    setModal(null);
  };

  const discharge = (date: string, outcome: Outcome, notes: string) => {
    if (!discharging) return;
    // TODO: PUT /admissions/:id/discharge via a services/ call
    setAdmissions((prev) =>
      prev.map((a) =>
        a.id === discharging.id ? { ...a, status: "Discharged", dischargedOn: date, outcome, dischargeNotes: notes || undefined } : a
      )
    );
    setModal(null);
    setTab("discharged");
  };

  return (
    <div className="space-y-6">
      {/* Ward cards double as filters */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {wardStats.map((w) => (
          <button
            key={w.name}
            onClick={() => setWardFilter(wardFilter === w.name ? "all" : w.name)}
            className={`rounded-xl border bg-white p-5 text-left transition ${
              wardFilter === w.name ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm text-slate-500">{w.name}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">
              {w.free}
              <span className="ml-1 text-sm font-normal text-slate-400">beds free</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div className={`h-1.5 rounded-full ${w.pct > 85 ? "bg-rose-500" : "bg-blue-600"}`} style={{ width: `${w.pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {w.occupied} of {w.beds} occupied ({w.pct}%)
            </p>
          </button>
        ))}
      </div>

      {/* Bed map */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Bed map</h2>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-blue-600" /> Occupied
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-dashed border-slate-300" /> Free{can("Admissions", "create") ? " (click to admit)" : ""}
            </span>
          </div>
        </div>
        <div className="space-y-5 p-5">
          {mapWards.map((w) => (
            <div key={w.name}>
              <p className="mb-2 text-xs font-medium uppercase text-slate-500">{w.name}</p>
              <div className="flex flex-wrap gap-2">
                {bedsOf(w.name).map((bed) => {
                  const who = bedOccupant(w.name, bed);
                  return who ? (
                    <div
                      key={bed}
                      title={`${bed} — ${who.patient} (${who.diagnosis})`}
                      className="flex h-9 w-12 items-center justify-center rounded bg-blue-600 text-xs font-medium text-white"
                    >
                      {bed}
                    </div>
                  ) : (
                    <button
                      key={bed}
                      disabled={!can("Admissions", "create")}
                      onClick={() => setModal({ type: "admit", ward: w.name, bed })}
                      title={`${bed} — free`}
                      className="flex h-9 w-12 items-center justify-center rounded border border-dashed border-slate-300 text-xs text-slate-400 hover:border-blue-500 hover:text-blue-600 disabled:cursor-default disabled:hover:border-slate-300 disabled:hover:text-slate-400"
                    >
                      {bed}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Admissions table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  ["current", `Current (${current.length})`],
                  ["discharged", "Discharged"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                    tab === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient, ID or bed"
                className="w-60 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {wardFilter !== "all" && (
              <button onClick={() => setWardFilter("all")} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                {wardFilter} · clear filter
              </button>
            )}
          </div>

          {can("Admissions", "create") && (
            <button
              onClick={() => setModal({ type: "admit", ward: wardFilter === "all" ? undefined : wardFilter })}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Admit Patient
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Ward / bed</th>
                <th className="px-5 py-3">Diagnosis</th>
                <th className="px-5 py-3">Doctor</th>
                <th className="px-5 py-3">Admitted</th>
                {tab === "discharged" && <th className="px-5 py-3">Discharged</th>}
                <th className="px-5 py-3 text-right">Stay</th>
                <th className="px-5 py-3 text-right">Bed charges</th>
                {tab === "discharged" ? <th className="px-5 py-3">Outcome</th> : <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => {
                const days = stayDays(a);
                const rate = rates[a.ward];
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-blue-600">{a.id}</td>
                    <td className="px-5 py-3 text-slate-800">{a.patient}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {a.ward} · <span className="font-medium">{a.bed}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{a.diagnosis}</td>
                    <td className="px-5 py-3 text-slate-600">{a.doctor}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(a.admittedOn)}</td>
                    {tab === "discharged" && <td className="px-5 py-3 text-slate-600">{a.dischargedOn ? formatDate(a.dischargedOn) : "—"}</td>}
                    <td className="px-5 py-3 text-right text-slate-600">
                      {days} day{days > 1 ? "s" : ""}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-800">{rate !== undefined ? formatNaira(days * rate) : "—"}</td>
                    {tab === "discharged" ? (
                      <td className="px-5 py-3 text-slate-600">{a.outcome ?? "—"}</td>
                    ) : (
                      <td className="px-5 py-3">
                        {can("Admissions", "edit") && (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setModal({ type: "transfer", id: a.id })}
                              title="Transfer"
                              aria-label={`Transfer ${a.patient}`}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <ArrowRightLeft size={16} />
                            </button>
                            <button
                              onClick={() => setModal({ type: "discharge", id: a.id })}
                              title="Discharge"
                              aria-label={`Discharge ${a.patient}`}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                            >
                              <LogOut size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-8 text-center text-slate-400">
                    No {tab === "current" ? "current admissions" : "discharges"} found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          Bed charges = days × the daily ward rate from the Price List. Day of admission counts as day 1.
        </p>
      </div>

      {modal?.type === "admit" && (
        <AdmitForm admissions={admissions} presetWard={modal.ward} presetBed={modal.bed} onSave={admit} onClose={() => setModal(null)} />
      )}
      {transferring && <TransferForm admission={transferring} admissions={admissions} onSave={transfer} onClose={() => setModal(null)} />}
      {discharging && <DischargeForm admission={discharging} rate={rates[discharging.ward]} onSave={discharge} onClose={() => setModal(null)} />}
    </div>
  );
}