import { STORE_KEYS, loadStore, saveStore } from "../services/store";

export interface Supplier {
  id: string;
  name: string;
  contact?: string; // person to call
  phone?: string;
  email?: string;
  address?: string;
}

/** One delivery of one drug. Receipts are a record: they are never edited or deleted. */
export interface StockReceipt {
  id: string;
  date: string; // YYYY-MM-DD
  sku: string;
  drug: string;
  qty: number;
  batch?: string;
  expiry: string; // YYYY-MM-DD
  supplierId?: string;
  supplier?: string; // name as it was at the time
  unitCost?: number; // ₦ per unit
  reference?: string; // supplier's invoice or delivery note number
  receivedBy: string;
  createdAt: number;
}

// TODO: replace with services/ calls (GET/POST /suppliers, /stock-receipts). The backend should add the stock and the receipt together.
export const loadSuppliers = (): Supplier[] => loadStore<Supplier[]>(STORE_KEYS.suppliers, () => []);
export const saveSuppliers = (list: Supplier[]) => saveStore(STORE_KEYS.suppliers, list);
export const loadReceipts = (): StockReceipt[] => loadStore<StockReceipt[]>(STORE_KEYS.stockReceipts, () => []);
export const saveReceipts = (list: StockReceipt[]) => saveStore(STORE_KEYS.stockReceipts, list);

export const receiptValue = (r: StockReceipt) => Math.round((r.unitCost ?? 0) * r.qty * 100) / 100;