import { api } from "./api";

export interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  source?: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference?: string;
  claimId?: string;
}

export interface Invoice {
  id: string;
  number: string;
  patientId: string;
  patient: string;
  patientPhone?: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  discount: number;
  vatRate: number;
  notes?: string;
  payments: Payment[];
  totals: { subtotal: number; discount: number; vat: number; total: number };
  paid: number;
  balance: number;
  status: string;
}

export interface InvoiceInput {
  patientId: string;
  items: { description: string; qty: number; unitPrice: number }[];
  discount?: number;
  vatRate?: number;
  dueDate?: string;
  notes?: string;
}

export interface PaymentInput {
  amount: number;
  method: string;
  date?: string;
  reference?: string;
}

export interface InvoiceFilters {
  patientId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
}

function qs(f: InvoiceFilters) {
  const p = new URLSearchParams();
  if (f.patientId) p.set("patientId", f.patientId);
  if (f.status) p.set("status", f.status);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const billingApi = {
  list: async (f: InvoiceFilters = {}) =>
    (await api.get<{ invoices: Invoice[] }>(`/billing${qs(f)}`)).invoices,
  get: async (id: string) => (await api.get<{ invoice: Invoice }>(`/billing/${id}`)).invoice,
  methods: async () => (await api.get<{ methods: string[] }>("/billing/methods")).methods,
  create: (data: InvoiceInput) => api.post<{ invoice: Invoice }>("/billing", data),
  pay: (id: string, data: PaymentInput) =>
    api.post<{ invoice: Invoice }>(`/billing/${id}/payments`, data),
};
