import { todayISO, type PaymentMethod } from "./billing";

// ---------- Money accounts (cash, bank, POS) ----------
export const ACCOUNT_KINDS = ["Cash", "Bank", "POS / Mobile money"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export interface MoneyAccount {
  id: string;
  name: string;
  kind: AccountKind;
  bankName: string;
  accountNumber: string;
  opening: number;
  openingDate: string;
  active: boolean;
}

// ---------- Transactions ----------
export type TxnType = "Income" | "Expense" | "Transfer";
export type TxnSource = "manual" | "billing" | "payroll";

export const INCOME_CATEGORIES = ["Patient payments", "HMO / NHIA claims", "Donations & grants", "Other income"] as const;
export const EXPENSE_CATEGORIES = [
  "Salaries & wages",
  "Drugs & medical supplies",
  "Laboratory consumables",
  "Electricity & fuel",
  "Water",
  "Rent",
  "Equipment & maintenance",
  "Cleaning & sanitation",
  "Transport",
  "Insurance",
  "Taxes, pension & levies",
  "Bank charges",
  "Training",
  "Other expense",
] as const;

export interface Txn {
  id: string;
  date: string;
  type: TxnType;
  category: string;
  description: string;
  party: string;
  reference: string;
  amount: number;
  accountId: string;
  toAccountId?: string;
  source: TxnSource;
  recordedBy: string;
  recordedAt: number;
  voided?: { at: number; by: string; reason: string };
}

// ---------- Payroll ----------
export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  bankName: string;
  accountNumber: string;
  basic: number;
  housing: number;
  transport: number;
  otherAllowance: number;
  pensionPct: number;
  paye: number;
  otherDeduction: number;
  active: boolean;
}

export interface PayLine {
  employeeId: string;
  name: string;
  title: string;
  basic: number;
  allowances: number;
  bonus: number;
  gross: number;
  pension: number;
  paye: number;
  other: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  month: string;
  lines: PayLine[];
  status: "Draft" | "Paid";
  paidOn?: string;
  paidFromAccountId?: string;
  paidBy?: string;
  txnId?: string;
  remittedOn?: string;
  remittanceTxnId?: string;
}

export interface AccountsData {
  accounts: MoneyAccount[];
  txns: Txn[];
  employees: Employee[];
  runs: PayrollRun[];
}

export const emptyAccounts = (): AccountsData => ({
  accounts: [],
  txns: [],
  employees: [],
  runs: [],
});

// ---------- Helpers ----------
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const uid = () => Math.random().toString(36).slice(2, 10);

export const monthOf = (iso: string) => iso.slice(0, 7);
export const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
export const prevMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const lastMonths = (count: number, from = monthOf(todayISO())) => {
  const out = [from];
  while (out.length < count) out.unshift(prevMonth(out[0]));
  return out;
};

export const isLive = (t: Txn) => !t.voided;

export function effectOn(t: Txn, accountId: string): number {
  if (t.voided) return 0;
  if (t.type === "Income") return t.accountId === accountId ? t.amount : 0;
  if (t.type === "Expense") return t.accountId === accountId ? -t.amount : 0;
  if (t.accountId === accountId) return -t.amount;
  if (t.toAccountId === accountId) return t.amount;
  return 0;
}

export const balanceOfAccount = (a: MoneyAccount, txns: Txn[]) =>
  round2(a.opening + txns.filter((t) => t.date >= a.openingDate).reduce((s, t) => s + effectOn(t, a.id), 0));

export function payLine(e: Employee, bonus = 0, paye = e.paye, other = e.otherDeduction): PayLine {
  const allowances = e.housing + e.transport + e.otherAllowance;
  const gross = round2(e.basic + allowances + bonus);
  const pension = round2(((e.basic + e.housing + e.transport) * e.pensionPct) / 100);
  return {
    employeeId: e.id,
    name: e.name,
    title: e.title,
    basic: e.basic,
    allowances,
    bonus,
    gross,
    pension,
    paye,
    other,
    net: round2(gross - pension - paye - other),
  };
}

export const runTotals = (run: PayrollRun) => ({
  gross: round2(run.lines.reduce((s, l) => s + l.gross, 0)),
  net: round2(run.lines.reduce((s, l) => s + l.net, 0)),
  paye: round2(run.lines.reduce((s, l) => s + l.paye, 0)),
  pension: round2(run.lines.reduce((s, l) => s + l.pension, 0)),
  other: round2(run.lines.reduce((s, l) => s + l.other, 0)),
});

export function billingTxns(): Txn[] {
  return [];
}

export function loadAccounts(): AccountsData {
  return emptyAccounts();
}

export function saveAccounts(_d: AccountsData): void {
  /* use accountsApi */
}

export function loadLedger(): null {
  return null;
}

export function saveLedger(_d: unknown): void {}
