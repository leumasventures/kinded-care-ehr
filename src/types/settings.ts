import { HOSPITAL, HOSPITAL_DEFAULTS } from "./billing";

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
  lowStockThreshold: number; // units
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

const KEY = "hms_settings";

// TODO: replace localStorage with GET/PUT /settings via a services/ call
export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw === "object") {
      return {
        ...DEFAULT_SETTINGS,
        ...raw,
        hospital: { ...DEFAULT_SETTINGS.hospital, ...raw.hospital },
        notify: { ...DEFAULT_SETTINGS.notify, ...raw.notify },
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem("hms_hospital", JSON.stringify(s.hospital));
  } catch {
    /* storage unavailable: changes last until refresh */
  }
  // Keep the live object used by printouts in step with what was just saved.
  Object.assign(HOSPITAL, s.hospital);
}

export function clearSavedSettings() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("hms_hospital");
  } catch {
    /* ignore */
  }
}