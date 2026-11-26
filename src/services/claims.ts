import { api } from "./api";

export interface ClaimLine {
  invoiceId: string;
  amount?: number;
  [key: string]: unknown;
}

export interface Claim {
  id: string;
  number?: string;
  payer: string;
  status: string;
  total: number;
  approvedAmount?: number;
  receivedAmount?: number;
  reference?: string;
  lines: ClaimLine[];
  [key: string]: unknown;
}

export interface ClaimInput {
  payer: string;
  invoiceIds: string[];
  notes?: string;
}

export interface ClaimFilters {
  status?: string;
  payer?: string;
}

function qs(f: ClaimFilters) {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.payer) p.set("payer", f.payer);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const claimsApi = {
  list: async (f: ClaimFilters = {}) =>
    (await api.get<{ claims: Claim[] }>(`/claims${qs(f)}`)).claims,
  claimable: async () =>
    (await api.get<{ payers: { payer: string; invoices: unknown[] }[] }>("/claims/claimable")).payers,
  get: async (id: string) => (await api.get<{ claim: Claim }>(`/claims/${id}`)).claim,
  create: (data: ClaimInput) => api.post<{ claim: Claim }>("/claims", data),
  submit: (id: string, data: { reference?: string } = {}) =>
    api.post<{ claim: Claim }>(`/claims/${id}/submit`, data),
  approve: (id: string, data: { approvedAmount: number }) =>
    api.post<{ claim: Claim }>(`/claims/${id}/approve`, data),
  reject: (id: string, data: { reason: string }) =>
    api.post<{ claim: Claim }>(`/claims/${id}/reject`, data),
  pay: (id: string, data: { amount: number; method?: string; reference?: string }) =>
    api.post<{ claim: Claim }>(`/claims/${id}/payments`, data),
};
