import { readPriceListCache } from "../services/priceList";

export const CATEGORIES = [
  "Consultation",
  "Laboratory",
  "Imaging & Diagnostics",
  "Pharmacy",
  "Nursing Care",
  "Procedures",
  "Admission & Ward",
  "Maternity",
  "Surgery",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface PriceItem {
  id: string;
  code: string;
  name: string;
  category: Category;
  unit: string; // e.g. "per visit", "per test", "per day"
  price: number; // Nigerian Naira
}

export const CATEGORY_PREFIX: Record<Category, string> = {
  Consultation: "CON",
  Laboratory: "LAB",
  "Imaging & Diagnostics": "IMG",
  Pharmacy: "PHM",
  "Nursing Care": "NUR",
  Procedures: "PRO",
  "Admission & Ward": "ADM",
  Maternity: "MAT",
  Surgery: "SUR",
};

const mk = (category: Category, rows: [string, number, string][]): PriceItem[] =>
  rows.map(([name, price, unit], i) => ({
    id: `${CATEGORY_PREFIX[category]}-${i + 1}`,
    code: `${CATEGORY_PREFIX[category]}-${String(i + 1).padStart(3, "0")}`,
    name,
    category,
    unit,
    price,
  }));

// Starting prices are illustrative. Edit them on the Price List page to match your facility.
export const defaultPriceList: PriceItem[] = [
  ...mk("Consultation", []),
  ...mk("Laboratory", []),
  ...mk("Imaging & Diagnostics", []),
  ...mk("Pharmacy", []),
  ...mk("Nursing Care", []),
  ...mk("Procedures", []),
  ...mk("Admission & Ward", []),
  ...mk("Maternity", []),
  ...mk("Surgery", []),
];

const STORAGE_KEY = "hms_price_list";

/**
 * The hospital price list, as this tab last loaded it from the database (AppLayout loads it before any page is shown).
 * Pages that have not been moved over yet use this. New code should use usePriceList() or priceListApi from services/priceList.ts.
 */
export const loadPriceList: () => PriceItem[] = readPriceListCache;

/** Prices typed into THIS browser before the price list moved to the database. Only the Price List page uses this, to offer moving them. */
export function loadBrowserPriceList(): PriceItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PriceItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* fall through to defaults */
  }
  return defaultPriceList;
}

export function savePriceList(list: PriceItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: changes last until reload */
  }
}

/** Clears the browser copy (after it has been moved to the database). */
export function resetPriceList() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return defaultPriceList;
}

export function nextCode(category: Category, list: PriceItem[]) {
  const prefix = CATEGORY_PREFIX[category];
  const max = list.reduce((m, i) => {
    if (!i.code.startsWith(`${prefix}-`)) return m;
    const n = parseInt(i.code.slice(prefix.length + 1), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export const newId = () => Math.random().toString(36).slice(2, 10);