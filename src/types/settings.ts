import { HOSPITAL_DEFAULTS } from "./billing";

export interface HospitalProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface AppSettings {
  hospital: HospitalProfile;
  notify: {
    appointments: boolean;
    lowStock: boolean;
    labResults: boolean;
    overdueInvoices: boolean;
  };
  lowStockThreshold: number;
  invoiceDueDays: number;
  vatPercent: number;
  invoiceFooter: string;
  sessionTimeoutMins: number;
  minPasswordLength: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hospital: { ...HOSPITAL_DEFAULTS },
  notify: { appointments: true, lowStock: true, labResults: false, overdueInvoices: true },
  lowStockThreshold: 20,
  invoiceDueDays: 14,
  vatPercent: 0,
  invoiceFooter: "",
  sessionTimeoutMins: 30,
  minPasswordLength: 8,
};

export function loadSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    hospital: { ...DEFAULT_SETTINGS.hospital },
    notify: { ...DEFAULT_SETTINGS.notify },
  };
}

export function saveSettings(_s: AppSettings): void {
  /* use settings API when wired */
}

export function clearSavedSettings(): void {
  /* no browser settings store */
}
