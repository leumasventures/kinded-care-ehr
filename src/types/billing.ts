import { STORE_KEYS, loadStore } from "../services/store";
export type PaymentMethod = "Cash" | "Bank Transfer" | "POS" | "Cheque" | "HMO / Insurance";

export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "POS", "Cheque", "HMO / Insurance"];

export interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  /** Set on lines added automatically (e.g. "appt:A-201"), so the same visit is never charged twice. */
  source?: string;
}

export interface Payment {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

export interface Invoice {
  id: string;
  number: string;
  patientId: string; // registered patient (hms_patients)
  patient: string;
  patientPhone?: string;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  items: LineItem[];
  discount: number; // flat ₦ amount
  vatRate: number; // percent, 0 for most medical services
  notes?: string;
  payments: Payment[];
}

export type InvoiceStatus = "Paid" | "Partial" | "Unpaid" | "Overdue";

// Edit these for your facility; they appear on the printout.
export const HOSPITAL = {
  name: "Your Hospital Name",
  address: "Street address, City, State",
  phone: "+234 000 000 0000",
  email: "billing@hospital.com",
};

export const HOSPITAL_DEFAULTS = { ...HOSPITAL };

// The Settings page saves the hospital profile here; printouts read HOSPITAL, so they pick it up automatically.
try {
  const stored = JSON.parse(localStorage.getItem("hms_hospital") ?? "null");
  if (stored && typeof stored === "object") {
    for (const k of ["name", "address", "phone", "email"] as const) {
      if (typeof stored[k] === "string" && stored[k].trim()) HOSPITAL[k] = stored[k];
    }
  }
} catch {
  /* storage unavailable or corrupt: keep defaults */
}

const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatNaira = (n: number) => nairaFormat.format(n);

export const uid = () => Math.random().toString(36).slice(2, 10);

// Local-date helpers. (toISOString() converts to UTC, which shifts dates by a day in
// timezones ahead of UTC such as Nigeria's UTC+1.)
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const todayISO = () => toISO(new Date());

export const addDaysISO = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISO(d);
};

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcTotals(inv: Pick<Invoice, "items" | "discount" | "vatRate">) {
  const subtotal = round2(inv.items.reduce((s, i) => s + i.qty * i.unitPrice, 0));
  const discount = Math.min(inv.discount, subtotal);
  const taxable = round2(subtotal - discount);
  const vat = round2((taxable * inv.vatRate) / 100);
  const total = round2(taxable + vat);
  return { subtotal, discount, vat, total };
}

export const paidTotal = (inv: Invoice) => round2(inv.payments.reduce((s, p) => s + p.amount, 0));

export const balanceOf = (inv: Invoice) => round2(calcTotals(inv).total - paidTotal(inv));

export function statusOf(inv: Invoice): InvoiceStatus {
  const total = calcTotals(inv).total;
  const paid = paidTotal(inv);
  if (paid >= total) return "Paid";
  if (inv.dueDate < todayISO()) return "Overdue";
  return paid > 0 ? "Partial" : "Unpaid";
}

export function nextInvoiceNumber(invoices: Invoice[]) {
  const max = invoices.reduce((m, i) => {
    const n = parseInt(i.number.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  return `INV-${max + 1}`;
}

// Mock seed data. Replace with a services/ call when the backend is ready.
export const seedInvoices: Invoice[] = [];

/** Live data (survives reloads). Pages read this instead of the demo seed. */
export const loadInvoices = (): Invoice[] => loadStore(STORE_KEYS.invoices, () => seedInvoices);
