import { api } from "./api";

export interface Drug {
  id: string;
  name: string;
  sku?: string;
  form?: string;
  strength?: string;
  stock?: number;
  reorderLevel?: number;
  unit?: string;
  expiry?: string | null;
  price?: number;
  [key: string]: unknown;
}

export interface Prescription {
  id: string;
  patientId: string;
  patient?: string;
  drug?: string;
  drugId?: string;
  status: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  [key: string]: unknown;
}

export interface DrugInput {
  name: string;
  sku?: string;
  form?: string;
  strength?: string;
  reorderLevel?: number;
  unit?: string;
  price?: number;
}

export interface StockInput {
  quantity: number;
  reason?: string;
  expiry?: string;
  reference?: string;
}

export interface PrescribeInput {
  patientId: string;
  drugId: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  notes?: string;
}

function qs(params: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const pharmacyApi = {
  drugs: async (f: { search?: string; lowStock?: boolean; limit?: number } = {}) =>
    (await api.get<{ drugs: Drug[] }>(`/pharmacy/drugs${qs(f)}`)).drugs,
  addDrug: (data: DrugInput) => api.post<{ drug: Drug }>("/pharmacy/drugs", data),
  editDrug: (id: string, data: Partial<DrugInput>) =>
    api.put<{ drug: Drug }>(`/pharmacy/drugs/${id}`, data),
  stock: (id: string, data: StockInput) =>
    api.post<{ drug: Drug }>(`/pharmacy/drugs/${id}/stock`, data),
  movements: async (id: string) =>
    (await api.get<{ movements: unknown[] }>(`/pharmacy/drugs/${id}/movements`)).movements,

  prescriptions: async (f: { status?: string; patientId?: string; limit?: number } = {}) =>
    (await api.get<{ prescriptions: Prescription[] }>(`/pharmacy/prescriptions${qs(f)}`)).prescriptions,
  getPrescription: async (id: string) =>
    (await api.get<{ prescription: Prescription }>(`/pharmacy/prescriptions/${id}`)).prescription,
  prescribe: (data: PrescribeInput) =>
    api.post<{ prescription: Prescription }>("/pharmacy/prescriptions", data),
  dispense: (id: string) =>
    api.post<{ prescription: Prescription }>(`/pharmacy/prescriptions/${id}/dispense`, {}),
  cancelPrescription: (id: string, reason: string) =>
    api.post<{ prescription: Prescription }>(`/pharmacy/prescriptions/${id}/cancel`, { reason }),
};
