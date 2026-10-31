import { addDaysISO, seedInvoices, todayISO, type PaymentMethod } from "./billing";

// ---------- Money accounts (cash, bank, POS) ----------
export const ACCOUNT_KINDS = ["Cash", "Bank", "POS / Mobile money"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export interface MoneyAccount {
  id: string;
  name: string;
  kind: AccountKind;
  bankName: string;
  accountNumber: string;
  opening: number; // balance when you started recording here
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
  date: string; // YYYY-MM-DD
  type: TxnType;
  category: string;
  description: string;
  party: string; // payer or payee
  reference: string;
  amount: number; // always positive
  accountId: string; // income: paid into, expense: paid from, transfer: from
  toAccountId?: string; // transfer only
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
  pensionPct: number; // employee pension contribution, % of basic + housing + transport
  paye: number; // monthly income tax, entered from your own tax computation
  otherDeduction: number;
  active: boolean;
}

export interface PayLine {
  employeeId: string;
  name: string;
  title: string;
  basic: number;
  allowances: number; // housing + transport + other
  bonus: number;
  gross: number;
  pension: number;
  paye: number;
  other: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  month: string; // YYYY-MM
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

/** Net effect of a transaction on one account. */
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

// ---------- Patient payments come from Billing ----------
export const ACC_CASH = "acc-cash";
export const ACC_BANK = "acc-bank";
export const ACC_POS = "acc-pos";

const methodAccount = (m: PaymentMethod) => (m === "Cash" ? ACC_CASH : m === "POS" ? ACC_POS : ACC_BANK);

// TODO: replace with a services/ call that returns invoice payments from the backend.
export function billingTxns(): Txn[] {
  return seedInvoices.flatMap((inv) =>
    inv.payments.map<Txn>((p) => ({
      id: `bill-${inv.id}-${p.id}`,
      date: p.date,
      type: "Income",
      category: p.method === "HMO / Insurance" ? "HMO / NHIA claims" : "Patient payments",
      description: `Invoice ${inv.number}`,
      party: inv.patient,
      reference: p.reference ?? "",
      amount: p.amount,
      accountId: methodAccount(p.method),
      source: "billing",
      recordedBy: "Billing",
      recordedAt: 0,
    }))
  );
}

// ---------- Mock store (browser localStorage) ----------
// TODO: replace with services/ calls (/accounts, /transactions, /employees, /payroll).
const KEY = "hms_accounts";

const ago = (days: number) => addDaysISO(todayISO(), -days);

const emp = (
  n: number,
  name: string,
  title: string,
  department: string,
  basic: number,
  housing: number,
  transport: number,
  paye: number,
  bank = "Your bank",
  other = 0
): Employee => ({
  id: `EMP-${String(n).padStart(3, "0")}`,
  name,
  title,
  department,
  bankName: bank,
  accountNumber: "",
  basic,
  housing,
  transport,
  otherAllowance: other,
  pensionPct: 8,
  paye,
  otherDeduction: 0,
  active: true,
});

function seed(): AccountsData {
  const base = ago(75);
  const accounts: MoneyAccount[] = [
    { id: ACC_CASH, name: "Cash on hand", kind: "Cash", bankName: "", accountNumber: "", opening: 600000, openingDate: base, active: true },
    { id: ACC_BANK, name: "Main bank account", kind: "Bank", bankName: "Your bank", accountNumber: "", opening: 4500000, openingDate: base, active: true },
    { id: ACC_POS, name: "POS settlement", kind: "POS / Mobile money", bankName: "", accountNumber: "", opening: 0, openingDate: base, active: true },
  ];

  const t = (
    daysAgo: number,
    type: TxnType,
    category: string,
    description: string,
    party: string,
    amount: number,
    accountId: string,
    by: string,
    reference = ""
  ): Txn => ({
    id: uid(), date: ago(daysAgo), type, category, description, party, reference, amount, accountId,
    source: "manual", recordedBy: by, recordedAt: Date.now() - daysAgo * 86_400_000,
  });

  const employees: Employee[] = [
    emp(1, "Dr. Eze", "Consultant Physician", "Medical", 450000, 90000, 60000, 62000),
    emp(2, "Dr. Obi", "Obstetrician", "Medical", 450000, 90000, 60000, 62000),
    emp(3, "Dr. Ade", "Paediatrician", "Medical", 420000, 85000, 55000, 57000),
    emp(4, "Dr. Nwankwo", "Surgeon", "Medical", 480000, 95000, 65000, 68000),
    emp(5, "Chioma Nurse", "Senior Nurse", "Nursing", 150000, 30000, 20000, 9000),
    emp(6, "Ngozi Nurse", "Staff Nurse", "Nursing", 130000, 26000, 18000, 6500),
    emp(7, "Tobi Pharm", "Pharmacist", "Pharmacy", 200000, 40000, 25000, 14000),
    emp(8, "Kelechi Cash", "Cashier", "Accounts", 90000, 18000, 12000, 2500),
    emp(9, "Emeka Lab", "Medical Lab Scientist", "Laboratory", 180000, 36000, 24000, 11000),
    emp(10, "Ada Cleaner", "Cleaner", "Support", 60000, 0, 8000, 0),
  ];

  const lastMonth = prevMonth(monthOf(todayISO()));
  const lines = employees.map((e) => payLine(e));
  const paidOn = `${lastMonth}-28`;
  const payrollTxn: Txn = {
    id: uid(), date: paidOn, type: "Expense", category: "Salaries & wages",
    description: `Payroll for ${monthLabel(lastMonth)} (${lines.length} staff)`, party: "Staff", reference: "",
    amount: round2(lines.reduce((s, l) => s + l.net, 0)), accountId: ACC_BANK, source: "payroll", recordedBy: "Kelechi Cash", recordedAt: Date.now() - 35 * 86_400_000,
  };

  return {
    accounts,
    employees,
    txns: [
      t(60, "Income", "Donations & grants", "Community health grant, first tranche", "State Ministry of Health", 1200000, ACC_BANK, "Admin User", "GR-2026-014"),
      t(50, "Income", "HMO / NHIA claims", "Claims settlement for August", "Hygeia HMO", 640000, ACC_BANK, "Kelechi Cash", "HMO-8841"),
      t(33, "Expense", "Rent", "Annex building rent, quarter", "Landlord", 750000, ACC_BANK, "Kelechi Cash"),
      t(26, "Expense", "Drugs & medical supplies", "Restock of antibiotics and IV fluids", "Emzor Distributors", 685000, ACC_BANK, "Kelechi Cash", "INV-5521"),
      t(18, "Expense", "Electricity & fuel", "Diesel for generator", "Aba Fuel Depot", 180000, ACC_CASH, "Kelechi Cash"),
      t(14, "Expense", "Laboratory consumables", "Reagents and test kits", "MedLab Supplies", 210000, ACC_BANK, "Kelechi Cash"),
      t(10, "Expense", "Electricity & fuel", "Electricity bill (prepaid meter)", "Enugu Electricity Distribution", 95000, ACC_BANK, "Kelechi Cash"),
      t(8, "Expense", "Cleaning & sanitation", "Cleaning supplies and waste disposal", "CleanCo", 48000, ACC_CASH, "Kelechi Cash"),
      t(6, "Transfer", "Cash deposit", "Banked cash takings", "", 100000, ACC_CASH, "Kelechi Cash"),
      t(4, "Expense", "Equipment & maintenance", "Servicing of oxygen concentrator", "BioMed Services", 120000, ACC_BANK, "Admin User"),
      t(2, "Expense", "Transport", "Ambulance fuel and driver allowance", "Transport desk", 35000, ACC_CASH, "Kelechi Cash"),
      t(1, "Income", "Other income", "Rental of hall to community group", "Aba Youth Forum", 60000, ACC_CASH, "Kelechi Cash"),
      payrollTxn,
    ].map((x) => (x.type === "Transfer" ? { ...x, toAccountId: ACC_BANK } : x)),
    runs: [
      { id: uid(), month: lastMonth, lines, status: "Paid", paidOn, paidFromAccountId: ACC_BANK, paidBy: "Kelechi Cash", txnId: payrollTxn.id },
    ],
  };
}

export function loadAccounts(): AccountsData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && Array.isArray(raw.accounts) && Array.isArray(raw.txns) && Array.isArray(raw.employees) && Array.isArray(raw.runs)) return raw as AccountsData;
  } catch {
    /* ignore */
  }
  return seed();
}

export function saveAccounts(d: AccountsData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable: changes last until refresh */
  }
}