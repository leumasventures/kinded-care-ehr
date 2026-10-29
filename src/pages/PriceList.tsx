import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Printer, RotateCcw, Search, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/billing/Modal";
import PriceListPrint from "../components/billing/PriceListPrint";
import { formatNaira } from "../types/billing";
import {
  CATEGORIES,
  loadPriceList,
  newId,
  nextCode,
  resetPriceList,
  savePriceList,
  type Category,
  type PriceItem,
} from "../types/pricing";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function ItemForm({
  item,
  list,
  defaultCategory,
  onSave,
  onClose,
}: {
  item: PriceItem | null; // null = new
  list: PriceItem[];
  defaultCategory: Category;
  onSave: (item: PriceItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<Category>(item?.category ?? defaultCategory);
  const [unit, setUnit] = useState(item?.unit ?? "per visit");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const n = Number(price);
    if (!trimmed) return setError("Name is required.");
    if (!(n >= 0) || price === "") return setError("Enter a valid price in naira.");
    const duplicate = list.some(
      (i) => i.id !== item?.id && i.category === category && i.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) return setError("That item already exists in this category.");

    // TODO: POST/PUT to the backend via a services/ call
    onSave({
      id: item?.id ?? newId(),
      code: item && item.category === category ? item.code : nextCode(category, list),
      name: trimmed,
      category,
      unit: unit.trim() || "each",
      price: n,
    });
  };

  return (
    <Modal title={item ? `Edit ${item.code}` : "Add Price Item"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Service / item name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Category</span>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Unit</span>
            <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="per visit" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Price (₦)</span>
            <input type="number" min="0" step="0.01" className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function PriceList() {
  const { can } = useAuth();
  const [items, setItems] = useState<PriceItem[]>(loadPriceList);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | Category>("All");
  const [editing, setEditing] = useState<PriceItem | "new" | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    savePriceList(items);
  }, [items]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + 1));
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => category === "All" || i.category === category)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.code.localeCompare(b.code)
      );
  }, [items, query, category]);

  const save = (item: PriceItem) => {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]));
    setEditing(null);
  };

  const remove = (item: PriceItem) => {
    if (window.confirm(`Delete "${item.name}" from the price list?`)) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  const reset = () => {
    if (window.confirm("Reset the whole price list to the default prices? Your changes will be lost.")) {
      setItems(resetPriceList());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search service, drug or code"
            className="w-72 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPrinting(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer size={16} /> Print
          </button>
          {can("Billing", "delete") && (
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw size={16} /> Reset
            </button>
          )}
          {can("Billing", "create") && (
            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Add Item
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              category === c ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {c} ({c === "All" ? items.length : counts.get(c) ?? 0})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Service / item</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Unit</th>
              <th className="px-5 py-3 text-right">Price</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((i) => (
              <tr key={i.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-blue-600">{i.code}</td>
                <td className="px-5 py-3 text-slate-800">{i.name}</td>
                <td className="px-5 py-3 text-slate-600">{i.category}</td>
                <td className="px-5 py-3 text-slate-500">{i.unit}</td>
                <td className="px-5 py-3 text-right font-medium text-slate-800">{formatNaira(i.price)}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    {can("Billing", "edit") && (
                      <button
                        onClick={() => setEditing(i)}
                        aria-label={`Edit ${i.name}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {can("Billing", "delete") && (
                      <button
                        onClick={() => remove(i)}
                        aria-label={`Delete ${i.name}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {items.length} items. Invoices can pick from this list when you type an item name.
      </p>

      {editing && (
        <ItemForm
          item={editing === "new" ? null : editing}
          list={items}
          defaultCategory={category === "All" ? "Consultation" : category}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {printing && <PriceListPrint items={filtered} onClose={() => setPrinting(false)} />}
    </div>
  );
}