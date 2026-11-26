// The price list as stored in the hospital database. Pages call these instead of reading the browser's storage.
import { useEffect, useState } from "react";
import { api, ApiError, onSessionCleared } from "./api";
import type { Category, PriceItem } from "../types/pricing";

export interface PriceItemInput {
  name: string;
  category: Category;
  unit: string;
  price: number;
  code?: string; // only sent when importing items that already have a code; otherwise the server makes it
}

// ---- The list as this tab last loaded it ----
// Pages that have not been moved to the database yet call loadPriceList() (types/pricing.ts) and expect an answer at once.
// Every successful load of the list is kept here, in sessionStorage (cleared when the tab closes or the person signs out),
// and AppLayout loads it before showing any page. It goes away once every page uses usePriceList().
const CACHE_KEY = "hms_price_cache";

export function readPriceListCache(): PriceItem[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as PriceItem[]) : [];
  } catch {
    return [];
  }
}

function rememberPriceList(items: PriceItem[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    /* storage blocked: the pages that need it just see an empty list */
  }
}
onSessionCleared(() => {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
});

export const priceListApi = {
  /** Items that are on the list (removed items are not returned). */
  list: async (): Promise<PriceItem[]> => {
    const items = (await api.get<{ items: PriceItem[] }>("/price-list")).items;
    rememberPriceList(items);
    return items;
  },
  create: (data: PriceItemInput) => api.post<{ item: PriceItem }>("/price-list", data),
  update: (id: string, data: Partial<Omit<PriceItemInput, "code">>) => api.put(`/price-list/${id}`, data),
  /** "Delete" takes the item off the list but keeps its history. */
  remove: (id: string) => api.put(`/price-list/${id}`, { active: false }),
};

/**
 * The current price list, for forms that need to offer services or tests (lab catalogue, visit fees...).
 * It replaces loadPriceList() from types/pricing.ts, which only sees what was typed into this browser.
 */
export function usePriceList(): { items: PriceItem[]; loading: boolean; error: string } {
  const [state, setState] = useState<{ items: PriceItem[]; loading: boolean; error: string }>({ items: [], loading: true, error: "" });
  useEffect(() => {
    let stale = false;
    priceListApi
      .list()
      .then((items) => !stale && setState({ items, loading: false, error: "" }))
      .catch((e) => !stale && setState({ items: [], loading: false, error: e instanceof ApiError ? e.message : "Couldn't reach the server." }));
    return () => {
      stale = true;
    };
  }, []);
  return state;
}