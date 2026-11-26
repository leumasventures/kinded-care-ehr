import { api } from "./api";

export interface DashboardOverview {
  date: string;
  patients: number;
  appointmentsToday: { total: number; byStatus: Record<string, number> };
  admitted: { total: number; byWard: { ward: string; occupied: number }[] };
  laboratory: {
    waitingCollection: number;
    waitingResults: number;
    resultsToReview: number;
    criticalToReview: number;
  };
  pharmacy: { pendingPrescriptions: number; lowStockDrugs: number };
  onDutyToday: Record<string, number>;
}

export interface DashboardFinance {
  date: string;
  billedToday: { invoices: number; amount: number };
  collectedToday: { total: number; byMethod: { method: string; total: number }[] };
  collectedThisMonth: number;
  outstanding: { invoices: number; amount: number; overdueInvoices: number; overdueAmount: number };
  claims?: Record<string, number>;
}

export const dashboardApi = {
  overview: () => api.get<{ overview: DashboardOverview }>("/dashboard").then((r) => r.overview),
  money: () => api.get<{ finance: DashboardFinance }>("/dashboard/money").then((r) => r.finance),
};
