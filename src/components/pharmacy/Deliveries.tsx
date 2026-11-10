import { useMemo, useState, type FormEvent } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { STORE_KEYS, usePersisted } from "../../services/store";
import { logAudit } from "../../services/audit";
import Modal from "../billing/Modal";
import { formatDate, formatNaira, uid } from "../../types/billing";
import { loadReceipts, loadSuppliers, receiptValue, type StockReceipt, type Supplier } from "../../types/suppliers";

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const csvCell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

function SupplierForm({ supplier, others, onSave, onClose }: { supplier: Supplier | null; others: Supplier[]; onSave: (s: Supplier) => void; onClose: () => void }) {
  const [v, setV] = useState({ name: supplier?.name ?? "", contact: supplier?.contact ?? "", phone: supplier?.phone ?? "", email: supplier?.email ?? "", address: supplier?.address ?? "" });
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = v.name.trim();
    if (!name) return setError("Supplier name is required.");
    if (others.some((o) => o.id !== supplier?.id && o.name.toLowerCase() === name.toLowerCase())) return setError("A supplier with this name already exists.");
    onSave({ id: supplier?.id ?? uid(), name, contact: v.contact.trim() || undefined, phone: v.phone.trim() || undefined, email: v.email.trim() || undefined, address: v.address.trim() || undefined });
  };
  const f = (k: keyof typeof v, label: string, span = "") => (
    <label className={`block text-sm ${span}`}><span className="mb-1 block text-slate-600">{label}</span><input className={inputClass} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
  );
  return (
    <Modal title={supplier ? "Edit supplier" : "Add supplier"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {f("name", "Supplier name", "sm:col-span-2")}
        {f("contact", "Contact person")}
        {f("phone", "Phone")}
        {f("email", "Email", "sm:col-span-2")}
        {f("address", "Address", "sm:col-span-2")}
        {error && <p role="alert" className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">Save</button>
        </div>
      </form>
    </Modal>
  );
}

/** Pharmacy "Deliveries" tab: every stock-in with its batch, expiry, supplier and cost, plus the supplier list. */
export default function Deliveries({ canManage }: { canManage: boolean }) {
  const [suppliers, setSuppliers] = usePersisted<Supplier[]>(STORE_KEYS.suppliers, loadSuppliers);
  const receipts = useMemo(() => loadReceipts().sort((a, b) => b.createdAt - a.createdAt), []);
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);

  const rows = receipts.filter((r) => supplierFilter === "all" || r.supplierId === supplierFilter);
  const total = rows.reduce((s, r) => s + receiptValue(r), 0);
  const deliveriesBy = (id: string) => receipts.filter((r) => r.supplierId === id).length;

  const save = (s: Supplier) => {
    const isNew = !suppliers.some((x) => x.id === s.id);
    setSuppliers((p) => (isNew ? [...p, s] : p.map((x) => (x.id === s.id ? s : x))));
    logAudit({ action: isNew ? "Create" : "Update", module: "Pharmacy", summary: `${isNew ? "Added" : "Updated"} supplier ${s.name}` });
    setEditing(null);
  };
  const remove = (s: Supplier) => {
    if (deliveriesBy(s.id) > 0) return window.alert(`${s.name} has ${deliveriesBy(s.id)} recorded deliveries, so it can't be deleted. Delivery records are kept.`);
    if (!window.confirm(`Delete supplier ${s.name}?`)) return;
    setSuppliers((p) => p.filter((x) => x.id !== s.id));
    logAudit({ action: "Delete", module: "Pharmacy", summary: `Deleted supplier ${s.name}` });
  };

  const exportCsv = () => {
    const head = ["Date", "Drug", "Quantity", "Batch", "Expiry", "Supplier", "Unit cost", "Total cost", "Reference", "Received by"];
    const body = rows.map((r) => [r.date, r.drug, String(r.qty), r.batch ?? "", r.expiry, r.supplier ?? "", String(r.unitCost ?? ""), String(receiptValue(r)), r.reference ?? "", r.receivedBy]);
    const blob = new Blob([[head, ...body].map((l) => l.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-deliveries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAudit({ action: "Export", module: "Pharmacy", summary: `Exported ${rows.length} stock deliveries to CSV` });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Suppliers ({suppliers.length})</h2>
          {canManage && <button onClick={() => setEditing("new")} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"><Plus size={14} /> Add supplier</button>}
        </div>
        <ul className="divide-y divide-slate-100">
          {suppliers.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-500">{[s.contact, s.phone, s.email].filter(Boolean).join(" · ") || "No contact details"} · {deliveriesBy(s.id)} deliveries</p>
              </div>
              {canManage && (
                <span className="flex gap-1">
                  <button onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(s)} aria-label={`Delete ${s.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                </span>
              )}
            </li>
          ))}
          {suppliers.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No suppliers yet. Add one here, or while receiving stock.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-800">Deliveries <span className="ml-2 text-sm font-normal text-slate-500">{rows.length} · {formatNaira(total)}</span></h2>
          <div className="flex gap-2">
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} aria-label="Filter by supplier" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
              <option value="all">All suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={exportCsv} disabled={rows.length === 0} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Download size={14} /> CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Drug</th><th className="px-5 py-3 text-right">Qty</th><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Expiry</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3 text-right">Cost</th><th className="px-5 py-3">Ref</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r: StockReceipt) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-slate-600">{formatDate(r.date)}</td>
                  <td className="px-5 py-3 text-slate-800">{r.drug}<span className="block text-xs text-slate-400">by {r.receivedBy}</span></td>
                  <td className="px-5 py-3 text-right">{r.qty}</td>
                  <td className="px-5 py-3 text-slate-600">{r.batch ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(r.expiry)}</td>
                  <td className="px-5 py-3 text-slate-600">{r.supplier ?? "—"}</td>
                  <td className="px-5 py-3 text-right">{r.unitCost !== undefined ? formatNaira(receiptValue(r)) : "—"}</td>
                  <td className="px-5 py-3 text-slate-500">{r.reference ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">No deliveries recorded yet. Use the receive button on a drug in Inventory.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editing && <SupplierForm supplier={editing === "new" ? null : editing} others={suppliers} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}