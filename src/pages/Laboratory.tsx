import { useMemo, useState, type FormEvent } from "react";
import { FileText, FlaskConical, Pencil, Plus, Search, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/billing/Modal";
import LabReportPrint from "../components/lab/LabReportPrint";
import { formatDate, formatNaira, todayISO } from "../types/billing";
import { loadPriceList } from "../types/pricing";
import { DOCTORS } from "../types/admissions";
import {
  FLAGS,
  LAB_STATUSES,
  nextLabId,
  orderTotal,
  seedLabOrders,
  type Flag,
  type LabOrder,
  type LabStatus,
  type LabTest,
  type Priority,
} from "../types/laboratory";

const statusStyle: Record<LabStatus, string> = {
  Pending: "bg-slate-100 text-slate-600",
  "Sample collected": "bg-violet-50 text-violet-700",
  Processing: "bg-amber-50 text-amber-700",
  Ready: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

const statusWeight: Record<LabStatus, number> = { Pending: 0, "Sample collected": 1, Processing: 2, Ready: 3, Cancelled: 4 };

const nextStep: Partial<Record<LabStatus, { label: string; to: LabStatus }>> = {
  Pending: { label: "Collect sample", to: "Sample collected" },
  "Sample collected": { label: "Start", to: "Processing" },
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function NewOrderForm({ orders, onSave, onClose }: { orders: LabOrder[]; onSave: (o: LabOrder) => void; onClose: () => void }) {
  const catalog = useMemo(() => loadPriceList().filter((p) => p.category === "Laboratory"), []);
  const [patient, setPatient] = useState("");
  const [requestedBy, setRequestedBy] = useState(DOCTORS[0]);
  const [priority, setPriority] = useState<Priority>("Routine");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");

  const visible = catalog.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const chosen = catalog.filter((p) => selected.includes(p.id));
  const total = chosen.reduce((s, p) => s + p.price, 0);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!patient.trim()) return setError("Patient name is required.");
    if (chosen.length === 0) return setError("Select at least one test.");
    // TODO: POST /lab-orders via a services/ call
    onSave({
      id: nextLabId(orders),
      patient: patient.trim(),
      requestedBy,
      date: todayISO(),
      priority,
      status: "Pending",
      clinicalNote: note.trim() || undefined,
      tests: chosen.map((p) => ({ id: p.id, name: p.name, price: p.price })),
    });
  };

  return (
    <Modal title="New Lab Order" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-1">
            <span className="mb-1 block text-slate-600">Patient name</span>
            <input className={inputClass} value={patient} onChange={(e) => setPatient(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Requested by</span>
            <select className={inputClass} value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}>
              {DOCTORS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Priority</span>
            <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option>Routine</option>
              <option>Urgent</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Clinical note (optional)</span>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-700">Tests ({selected.length} selected)</span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter tests"
              className="w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {visible.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="flex-1 text-slate-700">{p.name}</span>
                <span className="text-slate-500">{formatNaira(p.price)}</span>
              </label>
            ))}
            {visible.length === 0 && <p className="px-3 py-4 text-center text-sm text-slate-400">No matching tests.</p>}
          </div>
        </div>

        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Total: <span className="font-semibold text-slate-800">{formatNaira(total)}</span> (prices from the Price List; add to the patient's invoice in Billing)
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create Order
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResultsForm({ order, onSave, onClose }: { order: LabOrder; onSave: (tests: LabTest[]) => void; onClose: () => void }) {
  const [tests, setTests] = useState<LabTest[]>(order.tests.map((t) => ({ ...t, flag: t.flag ?? "Normal" })));
  const [error, setError] = useState("");

  const update = (id: string, patch: Partial<LabTest>) => setTests((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tests.some((t) => !t.result?.trim())) return setError("Enter a result for every test.");
    onSave(tests.map((t) => ({ ...t, result: t.result!.trim(), unit: t.unit?.trim() || undefined, range: t.range?.trim() || undefined })));
  };

  return (
    <Modal title={`Results — ${order.id} · ${order.patient}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {tests.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 text-sm font-medium text-slate-800">{t.name}</p>
            <div className="grid gap-3 sm:grid-cols-12">
              <input className={`${inputClass} sm:col-span-5`} placeholder="Result" value={t.result ?? ""} onChange={(e) => update(t.id, { result: e.target.value })} aria-label={`${t.name} result`} />
              <input className={`${inputClass} sm:col-span-2`} placeholder="Unit" value={t.unit ?? ""} onChange={(e) => update(t.id, { unit: e.target.value })} aria-label={`${t.name} unit`} />
              <input className={`${inputClass} sm:col-span-3`} placeholder="Reference range" value={t.range ?? ""} onChange={(e) => update(t.id, { range: e.target.value })} aria-label={`${t.name} reference range`} />
              <select className={`${inputClass} sm:col-span-2`} value={t.flag} onChange={(e) => update(t.id, { flag: e.target.value as Flag })} aria-label={`${t.name} flag`}>
                {FLAGS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <p className="text-xs text-slate-400">Use the reference ranges from your own analyser or lab protocol.</p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save &amp; mark Ready
          </button>
        </div>
      </form>
    </Modal>
  );
}

type ModalState = { type: "new" } | { type: "results"; id: string } | { type: "report"; id: string } | null;

export default function Laboratory() {
  const { can } = useAuth();
  const [orders, setOrders] = useState<LabOrder[]>(seedLabOrders);
  const [filter, setFilter] = useState<"All" | LabStatus>("All");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const counts = useMemo(() => {
    const m = new Map<LabStatus, number>();
    orders.forEach((o) => m.set(o.status, (m.get(o.status) ?? 0) + 1));
    return m;
  }, [orders]);

  const urgentOpen = orders.filter((o) => o.priority === "Urgent" && o.status !== "Ready" && o.status !== "Cancelled").length;

  const rows = orders
    .filter((o) => filter === "All" || o.status === filter)
    .filter((o) => {
      const q = query.trim().toLowerCase();
      return !q || o.patient.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.tests.some((t) => t.name.toLowerCase().includes(q));
    })
    .sort(
      (a, b) =>
        statusWeight[a.status] - statusWeight[b.status] ||
        Number(b.priority === "Urgent") - Number(a.priority === "Urgent") ||
        b.date.localeCompare(a.date) ||
        b.id.localeCompare(a.id)
    );

  const target = modal && modal.type !== "new" ? orders.find((o) => o.id === modal.id) : undefined;

  const setStatus = (id: string, status: LabStatus) => {
    // TODO: PUT /lab-orders/:id/status via a services/ call
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const cancel = (o: LabOrder) => {
    if (window.confirm(`Cancel lab order ${o.id} for ${o.patient}?`)) setStatus(o.id, "Cancelled");
  };

  const saveResults = (tests: LabTest[]) => {
    if (!target) return;
    setOrders((prev) => prev.map((o) => (o.id === target.id ? { ...o, tests, status: "Ready", reportedOn: o.reportedOn ?? todayISO() } : o)));
    setModal(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", ...LAB_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === s ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {s} ({s === "All" ? orders.length : counts.get(s) ?? 0})
            </button>
          ))}
        </div>
        {can("Laboratory", "create") && (
          <button onClick={() => setModal({ type: "new" })} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={16} /> New Lab Order
          </button>
        )}
      </div>

      {urgentOpen > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <FlaskConical size={16} /> {urgentOpen} urgent order{urgentOpen > 1 ? "s" : ""} still open.
        </div>
      )}

      <div className="relative w-72 max-w-full">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patient, order or test"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Patient</th>
              <th className="px-5 py-3">Tests</th>
              <th className="px-5 py-3">Requested by</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Fee</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((o) => {
              const step = nextStep[o.status];
              const open = o.status !== "Ready" && o.status !== "Cancelled";
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-blue-600">
                    {o.id}
                    {o.priority === "Urgent" && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700">Urgent</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-800">{o.patient}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {o.tests[0].name}
                    {o.tests.length > 1 && <span className="ml-1 text-xs text-slate-400" title={o.tests.map((t) => t.name).join(", ")}>+{o.tests.length - 1} more</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{o.requestedBy}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(o.date)}</td>
                  <td className="px-5 py-3 text-right text-slate-600">{formatNaira(orderTotal(o))}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[o.status]}`}>{o.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {can("Laboratory", "edit") && step && (
                        <button onClick={() => setStatus(o.id, step.to)} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                          {step.label}
                        </button>
                      )}
                      {can("Laboratory", "edit") && o.status === "Processing" && (
                        <button onClick={() => setModal({ type: "results", id: o.id })} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                          Enter results
                        </button>
                      )}
                      {o.status === "Ready" && (
                        <button onClick={() => setModal({ type: "report", id: o.id })} title="View / print report" aria-label={`View report for ${o.id}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                          <FileText size={16} />
                        </button>
                      )}
                      {can("Laboratory", "edit") && o.status === "Ready" && (
                        <button onClick={() => setModal({ type: "results", id: o.id })} title="Edit results" aria-label={`Edit results for ${o.id}`} className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {can("Laboratory", "edit") && open && (
                        <button onClick={() => cancel(o)} title="Cancel order" aria-label={`Cancel ${o.id}`} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                          <X size={15} />
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
                  No lab orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Pending → Collect sample → Start → Enter results → Ready. Urgent orders sort to the top of each stage.</p>

      {modal?.type === "new" && (
        <NewOrderForm
          orders={orders}
          onSave={(o) => {
            setOrders((prev) => [o, ...prev]);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "results" && target && <ResultsForm order={target} onSave={saveResults} onClose={() => setModal(null)} />}
      {modal?.type === "report" && target && <LabReportPrint order={target} onClose={() => setModal(null)} />}
    </div>
  );
}