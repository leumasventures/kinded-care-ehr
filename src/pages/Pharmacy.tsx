import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ClipboardCheck, PackagePlus, Pill, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/billing/Modal";
import { addDaysISO, formatDate, formatNaira, todayISO } from "../types/billing";
import { loadPriceList } from "../types/pricing";
import { DOCTORS } from "../types/admissions";
import {
  DRUG_CATEGORIES,
  isExpired,
  isExpiringSoon,
  isLow,
  isOut,
  nextRxId,
  nextSku,
  seedDispensing,
  seedDrugs,
  type Dispensing,
  type Drug,
  type DrugCategory,
} from "../types/pharmacy";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

type StockFilter = "all" | "low" | "out" | "expiry";

function Buttons({ onClose, label, disabled }: { onClose: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        Cancel
      </button>
      <button type="submit" disabled={disabled} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {label}
      </button>
    </div>
  );
}

function DrugForm({ drugs, onSave, onClose }: { drugs: Drug[]; onSave: (d: Drug) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DrugCategory>(DRUG_CATEGORIES[0]);
  const [unit, setUnit] = useState("strip");
  const [stock, setStock] = useState("0");
  const [reorderAt, setReorderAt] = useState("20");
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState(addDaysISO(todayISO(), 365));
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Drug name is required.");
    if (drugs.some((d) => d.name.toLowerCase() === n.toLowerCase())) return setError("That drug is already in the inventory.");
    if (Number(stock) < 0 || Number(reorderAt) < 0 || Number(price || 0) < 0) return setError("Numbers can't be negative.");
    // TODO: POST /drugs via a services/ call
    onSave({
      sku: nextSku(drugs),
      name: n,
      category,
      unit: unit.trim() || "unit",
      stock: Math.floor(Number(stock) || 0),
      reorderAt: Math.floor(Number(reorderAt) || 0),
      price: Number(price) || 0,
      expiry,
    });
  };

  return (
    <Modal title="Add Drug" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Drug name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Category</span>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as DrugCategory)}>
              {DRUG_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Unit (strip, vial, bottle…)</span>
            <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Opening stock</span>
            <input type="number" min="0" className={inputClass} value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Reorder level</span>
            <input type="number" min="0" className={inputClass} value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Unit price (₦)</span>
            <input type="number" min="0" step="0.01" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Expiry date</span>
            <input type="date" className={inputClass} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-slate-400">If the name exactly matches an item in the Price List, the Price List price is used instead.</p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Buttons onClose={onClose} label="Add Drug" />
      </form>
    </Modal>
  );
}

function ReceiveForm({ drug, onSave, onClose }: { drug: Drug; onSave: (qty: number, expiry: string) => void; onClose: () => void }) {
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState(addDaysISO(todayISO(), 365));
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Math.floor(Number(qty));
    if (!(n > 0)) return setError("Enter a quantity above 0.");
    if (expiry <= todayISO()) return setError("The new batch's expiry date must be in the future.");
    onSave(n, expiry);
  };

  return (
    <Modal title={`Receive stock — ${drug.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Current stock: <span className="font-medium text-slate-800">{drug.stock} {drug.unit}</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Quantity received</span>
            <input type="number" min="1" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Batch expiry</span>
            <input type="date" className={inputClass} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Buttons onClose={onClose} label="Receive" />
      </form>
    </Modal>
  );
}

const REASONS = ["Stock count correction", "Damaged", "Expired write-off", "Other"];

function CountForm({ drug, onSave, onClose }: { drug: Drug; onSave: (qty: number) => void; onClose: () => void }) {
  const [qty, setQty] = useState(String(drug.stock));
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Math.floor(Number(qty));
    if (!(n >= 0)) return setError("Enter the counted quantity (0 or more).");
    // TODO: POST /drugs/:sku/adjustments with the reason via a services/ call
    onSave(n);
  };

  return (
    <Modal title={`Stock count — ${drug.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">System stock: {drug.stock} {drug.unit}</p>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Counted quantity</span>
            <input type="number" min="0" className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Reason</span>
            <select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Buttons onClose={onClose} label="Update stock" />
      </form>
    </Modal>
  );
}

interface DraftLine {
  key: number;
  sku: string;
  qty: string;
}

function DispenseForm({
  drugs,
  priceOf,
  dispensing,
  onSave,
  onClose,
}: {
  drugs: Drug[];
  priceOf: (d: Drug) => number;
  dispensing: Dispensing[];
  onSave: (r: Dispensing) => void;
  onClose: () => void;
}) {
  const available = drugs.filter((d) => d.stock > 0 && !isExpired(d)).sort((a, b) => a.name.localeCompare(b.name));
  const [patient, setPatient] = useState("");
  const [prescriber, setPrescriber] = useState(DOCTORS[0]);
  const [lines, setLines] = useState<DraftLine[]>([{ key: 1, sku: available[0]?.sku ?? "", qty: "1" }]);
  const [error, setError] = useState("");

  const drugOf = (sku: string) => drugs.find((d) => d.sku === sku);
  const update = (key: number, patch: Partial<DraftLine>) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => {
    const d = drugOf(l.sku);
    return s + (d ? priceOf(d) * (Number(l.qty) || 0) : 0);
  }, 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!patient.trim()) return setError("Patient name is required.");
    const wanted = new Map<string, number>();
    for (const l of lines) {
      const q = Math.floor(Number(l.qty));
      if (!l.sku || !(q > 0)) return setError("Every line needs a drug and a quantity above 0.");
      wanted.set(l.sku, (wanted.get(l.sku) ?? 0) + q);
    }
    for (const [sku, q] of wanted) {
      const d = drugOf(sku)!;
      if (q > d.stock) return setError(`Only ${d.stock} ${d.unit} of ${d.name} in stock.`);
    }
    // TODO: POST /dispensing via a services/ call (the backend should deduct stock)
    const built = [...wanted].map(([sku, qty]) => {
      const d = drugOf(sku)!;
      return { sku, name: d.name, qty, unitPrice: priceOf(d) };
    });
    onSave({
      id: nextRxId(dispensing),
      date: todayISO(),
      patient: patient.trim(),
      prescriber,
      lines: built,
      total: built.reduce((s, l) => s + l.qty * l.unitPrice, 0),
    });
  };

  return (
    <Modal title="Dispense Drugs" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Patient name</span>
            <input className={inputClass} value={patient} onChange={(e) => setPatient(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Prescribed by</span>
            <select className={inputClass} value={prescriber} onChange={(e) => setPrescriber(e.target.value)}>
              {DOCTORS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Items</span>
            <button type="button" onClick={() => setLines((p) => [...p, { key: Date.now(), sku: available[0]?.sku ?? "", qty: "1" }])} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
              <Plus size={14} /> Add item
            </button>
          </div>
          {lines.map((l) => {
            const d = drugOf(l.sku);
            return (
              <div key={l.key} className="grid grid-cols-12 items-center gap-2">
                <select className={`${inputClass} col-span-12 sm:col-span-7`} value={l.sku} onChange={(e) => update(l.key, { sku: e.target.value })} aria-label="Drug">
                  {available.map((a) => (
                    <option key={a.sku} value={a.sku}>
                      {a.name} — {a.stock} {a.unit} left
                    </option>
                  ))}
                </select>
                <input type="number" min="1" max={d?.stock} className={`${inputClass} col-span-4 sm:col-span-2`} value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} aria-label="Quantity" />
                <span className="col-span-6 text-right text-sm text-slate-600 sm:col-span-2">{d ? formatNaira(priceOf(d) * (Number(l.qty) || 0)) : "—"}</span>
                <button
                  type="button"
                  onClick={() => setLines((p) => (p.length > 1 ? p.filter((x) => x.key !== l.key) : p))}
                  disabled={lines.length === 1}
                  aria-label="Remove item"
                  className="col-span-2 flex justify-center rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 sm:col-span-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>

        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Total: <span className="font-semibold text-slate-800">{formatNaira(total)}</span> — add it to the patient's invoice in Billing.
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Buttons onClose={onClose} label="Dispense" disabled={available.length === 0} />
      </form>
    </Modal>
  );
}

type ModalState = { type: "add" } | { type: "dispense" } | { type: "receive"; sku: string } | { type: "count"; sku: string } | null;

export default function Pharmacy() {
  const { can } = useAuth();
  const [drugs, setDrugs] = useState<Drug[]>(seedDrugs);
  const [log, setLog] = useState<Dispensing[]>(seedDispensing);
  const [tab, setTab] = useState<"inventory" | "log">("inventory");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | DrugCategory>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [modal, setModal] = useState<ModalState>(null);

  // Selling prices come from the Price List when the drug name matches.
  const priceMap = useMemo(() => new Map(loadPriceList().map((p) => [p.name.toLowerCase(), p.price])), []);
  const priceOf = (d: Drug) => priceMap.get(d.name.toLowerCase()) ?? d.price;

  const lowCount = drugs.filter((d) => isLow(d) || isOut(d)).length;
  const expiryCount = drugs.filter((d) => isExpired(d) || isExpiringSoon(d)).length;
  const stockValue = drugs.reduce((s, d) => s + d.stock * priceOf(d), 0);

  const rows = drugs
    .filter((d) => category === "all" || d.category === category)
    .filter((d) => {
      if (stockFilter === "low") return isLow(d);
      if (stockFilter === "out") return isOut(d);
      if (stockFilter === "expiry") return isExpired(d) || isExpiringSoon(d);
      return true;
    })
    .filter((d) => {
      const q = query.trim().toLowerCase();
      return !q || d.name.toLowerCase().includes(q) || d.sku.toLowerCase().includes(q);
    });

  const target = modal && (modal.type === "receive" || modal.type === "count") ? drugs.find((d) => d.sku === modal.sku) : undefined;

  const dispense = (r: Dispensing) => {
    setDrugs((prev) => prev.map((d) => {
      const line = r.lines.find((l) => l.sku === d.sku);
      return line ? { ...d, stock: d.stock - line.qty } : d;
    }));
    setLog((prev) => [r, ...prev]);
    setModal(null);
    setTab("log");
  };

  const receive = (qty: number, expiry: string) => {
    if (!target) return;
    // Expiry tracks whichever batch expires first.
    setDrugs((prev) =>
      prev.map((d) =>
        d.sku === target.sku
          ? { ...d, stock: d.stock + qty, expiry: d.stock > 0 && !isExpired(d) && d.expiry < expiry ? d.expiry : expiry }
          : d
      )
    );
    setModal(null);
  };

  const recount = (qty: number) => {
    if (!target) return;
    setDrugs((prev) => prev.map((d) => (d.sku === target.sku ? { ...d, stock: qty } : d)));
    setModal(null);
  };

  const remove = (d: Drug) => {
    if (window.confirm(`Remove ${d.name} from the inventory? Its stock record will be deleted.`)) {
      setDrugs((prev) => prev.filter((x) => x.sku !== d.sku));
    }
  };

  const cards = [
    { label: "Drugs in inventory", value: String(drugs.length), tone: "text-slate-800" },
    { label: "Stock value", value: formatNaira(stockValue), tone: "text-slate-800" },
    { label: "Low or out of stock", value: String(lowCount), tone: lowCount ? "text-amber-600" : "text-slate-800" },
    { label: "Expired / expiring ≤ 90 days", value: String(expiryCount), tone: expiryCount ? "text-rose-600" : "text-slate-800" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {(lowCount > 0 || expiryCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowCount > 0 && (
            <button onClick={() => { setTab("inventory"); setStockFilter("low"); }} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100">
              <AlertTriangle size={16} /> {lowCount} item{lowCount > 1 ? "s" : ""} to reorder
            </button>
          )}
          {expiryCount > 0 && (
            <button onClick={() => { setTab("inventory"); setStockFilter("expiry"); }} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800 hover:bg-rose-100">
              <AlertTriangle size={16} /> {expiryCount} expired or expiring soon
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ["inventory", "Inventory"],
              ["log", `Dispensing log (${log.length})`],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {can("Pharmacy", "edit") && (
            <button onClick={() => setModal({ type: "dispense" })} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              <Pill size={16} /> Dispense
            </button>
          )}
          {can("Pharmacy", "create") && (
            <button onClick={() => setModal({ type: "add" })} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus size={16} /> Add Drug
            </button>
          )}
        </div>
      </div>

      {tab === "inventory" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search drug or SKU" className="w-60 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value as "all" | DrugCategory)} aria-label="Filter by category" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All categories</option>
              {DRUG_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value as StockFilter)} aria-label="Filter by stock" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="all">All stock levels</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="expiry">Expired / expiring</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Drug</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3 text-right">Unit price</th>
                  <th className="px-5 py-3">Expiry</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((d) => {
                  const expired = isExpired(d);
                  const soon = isExpiringSoon(d);
                  return (
                    <tr key={d.sku} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-blue-600">{d.sku}</td>
                      <td className="px-5 py-3 text-slate-800">{d.name}</td>
                      <td className="px-5 py-3 text-slate-600">{d.category}</td>
                      <td className="px-5 py-3">
                        <span className={isOut(d) ? "font-semibold text-rose-600" : isLow(d) ? "font-semibold text-amber-600" : "text-slate-600"}>
                          {d.stock} {d.unit}
                        </span>
                        {isOut(d) && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">Out</span>}
                        {isLow(d) && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Low (≤ {d.reorderAt})</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">{formatNaira(priceOf(d))}</td>
                      <td className="px-5 py-3">
                        <span className={expired ? "font-semibold text-rose-600" : soon ? "text-amber-600" : "text-slate-600"}>{formatDate(d.expiry)}</span>
                        {expired && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-xs text-rose-700">Expired</span>}
                        {soon && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">Soon</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {can("Pharmacy", "edit") && (
                            <>
                              <button onClick={() => setModal({ type: "receive", sku: d.sku })} title="Receive stock" aria-label={`Receive stock for ${d.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600">
                                <PackagePlus size={16} />
                              </button>
                              <button onClick={() => setModal({ type: "count", sku: d.sku })} title="Stock count / adjust" aria-label={`Count stock for ${d.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                                <ClipboardCheck size={16} />
                              </button>
                            </>
                          )}
                          {can("Pharmacy", "delete") && (
                            <button onClick={() => remove(d)} title="Remove" aria-label={`Remove ${d.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      No drugs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {stockFilter !== "all" && (
            <button onClick={() => setStockFilter("all")} className="text-sm font-medium text-blue-600 hover:text-blue-700">
              Clear stock filter
            </button>
          )}
        </>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Rx no.</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Prescribed by</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {log.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-blue-600">{r.id}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(r.date)}</td>
                  <td className="px-5 py-3 text-slate-800">{r.patient}</td>
                  <td className="px-5 py-3 text-slate-600">{r.prescriber}</td>
                  <td className="px-5 py-3 text-slate-600">{r.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-800">{formatNaira(r.total)}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Nothing dispensed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === "add" && (
        <DrugForm
          drugs={drugs}
          onSave={(d) => {
            setDrugs((prev) => [...prev, d]);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "dispense" && <DispenseForm drugs={drugs} priceOf={priceOf} dispensing={log} onSave={dispense} onClose={() => setModal(null)} />}
      {modal?.type === "receive" && target && <ReceiveForm drug={target} onSave={receive} onClose={() => setModal(null)} />}
      {modal?.type === "count" && target && <CountForm drug={target} onSave={recount} onClose={() => setModal(null)} />}
    </div>
  );
}