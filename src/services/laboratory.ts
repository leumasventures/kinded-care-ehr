import { api } from "./api";

export interface LabTest {
  id?: string;
  code?: string;
  name: string;
  result?: string | null;
  unit?: string | null;
  referenceRange?: string | null;
  flag?: string | null;
}

export interface LabOrder {
  id: string;
  number?: string;
  patientId: string;
  patient?: string;
  patientName?: string;
  status: string;
  priority: string;
  tests: LabTest[];
  orderedBy?: string;
  orderedAt?: string;
  collectedAt?: string | null;
  resultedAt?: string | null;
  reviewedAt?: string | null;
  critical?: boolean;
  notes?: string | null;
}

export interface LabCatalogItem {
  id: string;
  code?: string;
  name: string;
  price?: number;
  category?: string;
}

export interface LabOrderInput {
  patientId: string;
  priority?: string;
  testIds?: string[];
  tests?: string[];
  notes?: string;
}

export interface LabFilters {
  status?: string;
  patientId?: string;
  priority?: string;
  unreviewed?: boolean;
  mine?: boolean;
  limit?: number;
}

function qs(f: LabFilters) {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.patientId) p.set("patientId", f.patientId);
  if (f.priority) p.set("priority", f.priority);
  if (f.unreviewed) p.set("unreviewed", "1");
  if (f.mine) p.set("mine", "1");
  if (f.limit !== undefined) p.set("limit", String(f.limit));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const laboratoryApi = {
  list: async (f: LabFilters = {}) =>
    (await api.get<{ orders: LabOrder[] }>(`/laboratory${qs(f)}`)).orders,
  tests: async () => (await api.get<{ tests: LabCatalogItem[] }>("/laboratory/tests")).tests,
  get: async (id: string) => (await api.get<{ order: LabOrder }>(`/laboratory/${id}`)).order,
  create: (data: LabOrderInput) => api.post<{ order: LabOrder; charged?: unknown }>("/laboratory", data),
  collect: (id: string) => api.post<{ order: LabOrder }>(`/laboratory/${id}/collect`, {}),
  results: (id: string, results: { testId: string; result: string; unit?: string; referenceRange?: string; flag?: string }[]) =>
    api.post<{ order: LabOrder; critical?: boolean }>(`/laboratory/${id}/results`, { results }),
  review: (id: string) => api.post<{ order: LabOrder }>(`/laboratory/${id}/review`, {}),
  cancel: (id: string, reason: string) =>
    api.post<{ order: LabOrder }>(`/laboratory/${id}/cancel`, { reason }),
};
