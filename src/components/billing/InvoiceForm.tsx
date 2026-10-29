import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "./Modal";
import {
  PAYMENT_METHODS,
  addDaysISO,
  calcTotals,
  formatNaira,
  todayISO,
  uid,
  type Invoice,
  type PaymentMethod,
} from "../../types/billing";
import { loadPriceList } from "../../types/pricing";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

interface DraftItem {
  id: string;
  description: string;
  qty: string;
  unitPrice: string;
}

interface InvoiceFormProps {
  number: string;
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
}

const blankItem = (): DraftItem => ({ id: uid(), description: "", qty: "1", unitPrice: "" });

export default function InvoiceForm({ number, onSave, onCancel }: InvoiceFormProps) {
  const [patient, setPatient] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 14));
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [discount, setDiscount] = useState("0");
  const [vatRate, setVatRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("Cash");
  const [payRef, setPayRef] = useState("");
  const [error, setError] = useState("");
  const priceList = useMemo(() => loadPriceList(), []);

  const parsedItems = items.map((i) => ({
    id: i.id,
    description: i.description.trim(),
    qty: Number(i.qty) || 0,
    unitPrice: Number(i.unitPrice) || 0,
  }));

  const totals = calcTotals({
    items: parsedItems,
    discount: Number(discount) || 0,
    vatRate: Number(vatRate) || 0,
  });

  // Picking a price-list name fills in the unit price (if it's still empty).
  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const next = { ...i, ...patch };
        if (patch.description !== undefined && !i.unitPrice) {
          const typed = patch.description.trim().toLowerCase();
          const match = priceList.find((p) => p.name.toLowerCase() === typed);
          if (match) next.unitPrice = String(match.price);
        }
        return next;
      })
    );

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();

    const validItems = parsedItems.filter((i) => i.description && i.qty > 0 && i.unitPrice > 0);
    const initialPayment = Number(payAmount) || 0;

    if (!patient.trim()) return setError("Patient name is required.");
    if (validItems.length === 0) return setError("Add at least one item with a description, quantity and price.");
    if (validItems.length !== parsedItems.filter((i) => i.description || i.unitPrice).length)
      return setError("Every item needs a description, a quantity above 0 and a price above 0.");
    if (Number(discount) < 0 || Number(discount) > totals.subtotal)
      return setError("Discount can't be negative or more than the subtotal.");
    if (dueDate < date) return setError("Due date can't be before the invoice date.");
    if (initialPayment < 0 || initialPayment > totals.total)
      return setError("Initial payment can't be negative or more than the invoice total.");

    // TODO: POST to the backend via a services/ call
    onSave({
      id: uid(),
      number,
      patient: patient.trim(),
      patientPhone: phone.trim() || undefined,
      date,
      dueDate,
      items: validItems,
      discount: totals.discount,
      vatRate: Number(vatRate) || 0,
      notes: notes.trim() || undefined,
      payments:
        initialPayment > 0
          ? [{ id: uid(), date, amount: initialPayment, method: payMethod, reference: payRef.trim() || undefined }]
          : [],
    });
  };

  return (
    <Modal title={`New Invoice ${number}`} onClose={onCancel} wide>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Patient name</span>
            <input className={inputClass} value={patient} onChange={(e) => setPatient(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Phone (optional)</span>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Invoice date</span>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Due date</span>
            <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">Items</h3>
            <button
              type="button"
              onClick={() => setItems((p) => [...p, blankItem()])}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={14} /> Add item
            </button>
          </div>

          <div className="space-y-2">
            <datalist id="price-list-options">
              {priceList.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <div className="hidden grid-cols-12 gap-2 text-xs uppercase text-slate-500 sm:grid">
              <span className="col-span-6">Description</span>
              <span className="col-span-2">Qty</span>
              <span className="col-span-3">Unit price (₦)</span>
            </div>
            {items.map((i) => (
              <div key={i.id} className="grid grid-cols-12 items-center gap-2">
                <input
                  className={`${inputClass} col-span-12 sm:col-span-6`}
                  placeholder="Type to search the price list"
                  list="price-list-options"
                  value={i.description}
                  onChange={(e) => updateItem(i.id, { description: e.target.value })}
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={`${inputClass} col-span-4 sm:col-span-2`}
                  value={i.qty}
                  onChange={(e) => updateItem(i.id, { qty: e.target.value })}
                  aria-label="Quantity"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputClass} col-span-6 sm:col-span-3`}
                  placeholder="0.00"
                  value={i.unitPrice}
                  onChange={(e) => updateItem(i.id, { unitPrice: e.target.value })}
                  aria-label="Unit price in naira"
                />
                <button
                  type="button"
                  onClick={() => removeItem(i.id)}
                  disabled={items.length === 1}
                  aria-label="Remove item"
                  className="col-span-2 flex justify-center rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 sm:col-span-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Discount (₦)</span>
              <input type="number" min="0" step="0.01" className={inputClass} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">VAT (%) — 0 for exempt medical services</span>
              <input type="number" min="0" max="100" step="0.1" className={inputClass} value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Notes (optional)</span>
              <textarea rows={2} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>

          <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatNaira(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>− {formatNaira(totals.discount)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>VAT</span>
              <span>{formatNaira(totals.vat)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-800">
              <span>Total</span>
              <span>{formatNaira(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-700">Payment received now (optional)</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Amount (₦)</span>
              <input type="number" min="0" step="0.01" className={inputClass} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Method</span>
              <select className={inputClass} value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Reference</span>
              <input className={inputClass} value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Create Invoice
          </button>
        </div>
      </form>
    </Modal>
  );
}