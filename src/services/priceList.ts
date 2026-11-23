// The price list as stored in the hospital database. Pages call these instead of reading the browser's storage.
import { api } from "./api";
import type { Category, PriceItem } from "../types/pricing";

export interface PriceItemInput {
  name: string;
  category: Category;
  unit: string;
  price: number;
  code?: string; // only sent when importing items that already have a code; otherwise the server makes it
}

export const priceListApi = {
  /** Items that are on the list (removed items are not returned). */
  list: async (): Promise<PriceItem[]> => (await api.get<{ items: PriceItem[] }>("/price-list")).items,
  create: (data: PriceItemInput) => api.post<{ item: PriceItem }>("/price-list", data),
  update: (id: string, data: Partial<Omit<PriceItemInput, "code">>) => api.put(`/price-list/${id}`, data),
  /** "Delete" takes the item off the list but keeps its history. */
  remove: (id: string) => api.put(`/price-list/${id}`, { active: false }),
};