// Automatic charging: when a visit is completed, a lab test is ordered, drugs are dispensed or a patient is discharged,
// the fee is added to the patient's open invoice (or a new one is started). Prices come from the Price List or the order itself.
// TODO: this belongs on the backend, in the same transaction as the event that causes the charge.
import { STORE_KEYS, saveStore } from "./store";
import { logAudit } from "./audit";
import { addDaysISO, balanceOf, calcTotals, formatNaira, loadInvoices, nextInvoiceNumber, paidTotal, todayISO, uid, type Invoice } from "../types/billing";
import { loadPriceList } from "../types/pricing";

export interface ChargeLine {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface ChargeResult {
  invoiceNumber: string;
  added: number;
  amount: number;
  skipped: number; // lines already charged earlier (same source) or without a price
}

export const priceOfService = (name: string): number | undefined => {
  const hit = loadPriceList().find((p) => p.name.toLowerCase() === name.toLowerCase());
  return hit && hit.price > 0 ? hit.price : undefined;
};

/**
 * Adds charge lines to the patient's most recent unsettled invoice, or opens a new one.
 * `source` identifies the event (e.g. "lab:L-501"); a line with the same source and description is never added twice.
 */
export function addCharges(
  patient: { id: string; name: string; phone?: string },
  source: string,
  lines: ChargeLine[],
  reason: string
): ChargeResult | null {
  const valid = lines.filter((l) => l.description && l.qty > 0 && l.unitPrice > 0);
  const invoices = loadInvoices();
  const already = new Set(invoices.filter((i) => i.patientId === patient.id).flatMap((i) => i.items.filter((x) => x.source === source).map((x) => x.description)));
  const fresh = valid.filter((l) => !already.has(l.description));
  const skipped = lines.length - fresh.length;
  if (fresh.length === 0) return null;

  const items = fresh.map((l) => ({ id: uid(), description: l.description, qty: l.qty, unitPrice: l.unitPrice, source }));
  const open = invoices
    .filter((i) => i.patientId === patient.id && balanceOf(i) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  let next: Invoice[];
  let number: string;
  if (open) {
    number = open.number;
    next = invoices.map((i) => (i.id === open.id ? { ...i, items: [...i.items, ...items] } : i));
  } else {
    number = nextInvoiceNumber(invoices);
    const invoice: Invoice = {
      id: uid(),
      number,
      patientId: patient.id,
      patient: patient.name,
      patientPhone: patient.phone || undefined,
      date: todayISO(),
      dueDate: addDaysISO(todayISO(), 14),
      items,
      discount: 0,
      vatRate: 0,
      notes: "Charges added automatically from hospital activity.",
      payments: [],
    };
    next = [invoice, ...invoices];
  }
  saveStore(STORE_KEYS.invoices, next);

  const amount = calcTotals({ items, discount: 0, vatRate: 0 }).total;
  logAudit({
    action: "Create",
    module: "Billing",
    summary: `Charged ${formatNaira(amount)} (${items.length} line${items.length === 1 ? "" : "s"}) to ${number} for ${patient.name} (${patient.id}): ${reason}`,
    detail: items.map((i) => `${i.qty} x ${i.description} @ ${formatNaira(i.unitPrice)}`).join("\n"),
  });
  return { invoiceNumber: number, added: items.length, amount, skipped };
}

export interface RemoveResult {
  removed: number;
  amount: number;
  /** Lines left in place because the invoice has already been paid beyond what would remain. */
  blocked: number;
  invoiceNumber?: string;
}

/** Takes back charges added for an event (e.g. a cancelled lab order). Paid-for lines are kept and must be adjusted in Billing. */
export function removeCharges(patientId: string, source: string, reason: string): RemoveResult {
  const invoices = loadInvoices();
  let removed = 0;
  let amount = 0;
  let blocked = 0;
  let invoiceNumber: string | undefined;
  const next: Invoice[] = [];
  for (const inv of invoices) {
    const lines = inv.patientId === patientId ? inv.items.filter((x) => x.source === source) : [];
    if (lines.length === 0) {
      next.push(inv);
      continue;
    }
    const trimmed = { ...inv, items: inv.items.filter((x) => x.source !== source) };
    if (paidTotal(inv) > calcTotals(trimmed).total) {
      blocked += lines.length;
      invoiceNumber = inv.number;
      next.push(inv);
      continue;
    }
    removed += lines.length;
    amount += calcTotals({ items: lines, discount: 0, vatRate: 0 }).total;
    invoiceNumber = inv.number;
    if (trimmed.items.length > 0 || inv.payments.length > 0) next.push(trimmed); // an emptied, unpaid invoice is dropped
  }
  if (removed > 0) {
    saveStore(STORE_KEYS.invoices, next);
    logAudit({ action: "Update", module: "Billing", summary: `Took back ${formatNaira(amount)} (${removed} line${removed === 1 ? "" : "s"}) from invoice ${invoiceNumber}: ${reason}` });
  }
  return { removed, amount, blocked, invoiceNumber };
}