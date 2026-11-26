import { api } from "./api";

function qs(from?: string, to?: string) {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const reportsApi = {
  revenue: (from?: string, to?: string) => api.get(`/reports/revenue${qs(from, to)}`),
  receivables: (from?: string, to?: string) => api.get(`/reports/receivables${qs(from, to)}`),
  claims: (from?: string, to?: string) => api.get(`/reports/claims${qs(from, to)}`),
  admissions: (from?: string, to?: string) => api.get(`/reports/admissions${qs(from, to)}`),
  appointments: (from?: string, to?: string) => api.get(`/reports/appointments${qs(from, to)}`),
  laboratory: (from?: string, to?: string) => api.get(`/reports/laboratory${qs(from, to)}`),
  pharmacy: (from?: string, to?: string) => api.get(`/reports/pharmacy${qs(from, to)}`),
};
