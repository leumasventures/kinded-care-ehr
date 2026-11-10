import { useMemo, useState, type ReactNode } from "react";
import { balanceOf, formatDate, formatNaira, loadInvoices, todayISO } from "../types/billing";
import { isLive, lastMonths, monthLabel, monthOf, round2, type Txn } from "../types/account";
import { useLedger, type Ledger } from "../components/accounts/useLedger";
import Transactions from "../components/accounts/Transactions";
import MoneyAccounts from "../components/accounts/MoneyAccounts";
import Payroll from "../components/accounts/Payroll";

type Tab = "overview" | "transactions" | "accounts" | "payroll";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "accounts", label: "Accounts" },
  { id: "payroll", label: "Payroll" },
];

function Card({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

const sum = (txns: Txn[], type: Txn["type"]) => round2(txns.filter((t) => t.type === type && isLive(t)).reduce((s, t) => s + t.amount, 0));

function Overview({ ledger }: { ledger: Ledger }) {
  const { txns, data, balances, accountName } = ledger;
  const month = monthOf(todayISO());

  const d = useMemo(() => {
    const thisMonth = txns.filter((t) => monthOf(t.date) === month);
    const income = sum(thisMonth, "Income");
    const expense = sum(thisMonth, "Expense");

    const months = lastMonths(6).map((m) => {
      const rows = txns.filter((t) => monthOf(t.date) === m);
      return { m, income: sum(rows, "Income"), expense: sum(rows, "Expense") };
    });

    const byCategory = new Map<string, number>();
    thisMonth.filter((t) => t.type === "Expense" && isLive(t)).forEach((t) => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount));
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

    return { income, expense, months, categories, receivable: loadInvoices().reduce((s, i) => s + Math.max(0, balanceOf(i)), 0) };
  }, [txns, month]);

  const total = round2(data.accounts.filter((a) => a.active).reduce((s, a) => s + (balances[a.id] ?? 0), 0));
  const net = round2(d.income - d.expense);
  const maxMonth = Math.max(1, ...d.months.flatMap((x) => [x.income, x.expense]));
  const maxCat = Math.max(1, ...d.categories.map(([, v]) => v));
  const recent = txns.filter(isLive).slice(0, 8);

  const cards = [
    { label: "Cash and bank balance", value: formatNaira(total), sub: `${data.accounts.filter((a) => a.active).length} active accounts`, tone: "" },
    { label: `Income, ${monthLabel(month)}`, value: formatNaira(d.income), sub: "Patient payments and other income", tone: "text-emerald-600" },
    { label: `Expenses, ${monthLabel(month)}`, value: formatNaira(d.expense), sub: "Including salaries paid", tone: "text-rose-600" },
    { label: "Net this month", value: formatNaira(net), sub: net >= 0 ? "Surplus" : "Deficit", tone: net >= 0 ? "text-emerald-600" : "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className={`mt-1 truncate text-2xl font-semibold ${c.tone || "text-slate-800"}`}>{c.value}</p>
            <p className="text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Income vs expenses (6 months)" className="lg:col-span-2">
          <div className="p-5">
            <div className="flex h-40 items-end gap-4">
              {d.months.map((x) => (
                <div key={x.m} className="flex flex-1 items-end justify-center gap-1" title={`${monthLabel(x.m)}: income ${formatNaira(x.income)}, expenses ${formatNaira(x.expense)}`}>
                  <div className="w-1/2 max-w-6 rounded-t bg-emerald-500" style={{ height: `${Math.max(x.income ? 3 : 0, (x.income / maxMonth) * 100)}%` }} />
                  <div className="w-1/2 max-w-6 rounded-t bg-rose-500" style={{ height: `${Math.max(x.expense ? 3 : 0, (x.expense / maxMonth) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-4">
              {d.months.map((x) => (
                <span key={x.m} className="flex-1 text-center text-xs text-slate-500">{new Date(`${x.m}-01T00:00:00`).toLocaleDateString("en-NG", { month: "short" })}</span>
              ))}
            </div>
            <p className="mt-3 flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Expenses</span>
            </p>
          </div>
        </Card>

        <Card title="Where the money is">
          <ul className="divide-y divide-slate-100">
            {data.accounts.filter((a) => a.active).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="text-slate-700">{a.name}</span>
                <span className={`font-medium ${(balances[a.id] ?? 0) < 0 ? "text-rose-600" : "text-slate-800"}`}>{formatNaira(balances[a.id] ?? 0)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 bg-slate-50 px-5 py-3 text-sm">
              <span className="text-slate-500">Owed by patients (unpaid invoices)</span>
              <span className="font-medium text-slate-800">{formatNaira(d.receivable)}</span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Spending by category, ${monthLabel(month)}`}>
          <div className="space-y-3 p-5">
            {d.categories.map(([name, value]) => (
              <div key={name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{name}</span>
                  <span className="text-slate-500">{formatNaira(value)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${(value / maxCat) * 100}%` }} /></div>
              </div>
            ))}
            {d.categories.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No expenses recorded this month.</p>}
          </div>
        </Card>

        <Card title="Recent activity">
          <ul className="divide-y divide-slate-100">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{t.description}</p>
                  <p className="text-xs text-slate-500">{formatDate(t.date)} · {accountName(t.accountId)}</p>
                </div>
                <span className={`shrink-0 font-medium ${t.type === "Income" ? "text-emerald-600" : t.type === "Expense" ? "text-rose-600" : "text-slate-600"}`}>
                  {t.type === "Income" ? "+" : t.type === "Expense" ? "−" : ""}{formatNaira(t.amount)}
                </span>
              </li>
            ))}
            {recent.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">Nothing recorded yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default function Accounts() {
  const ledger = useLedger();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview ledger={ledger} />}
      {tab === "transactions" && <Transactions ledger={ledger} />}
      {tab === "accounts" && <MoneyAccounts ledger={ledger} />}
      {tab === "payroll" && <Payroll ledger={ledger} />}

      <p className="text-xs text-slate-400">
        Patient payments are read from Billing. Entries are saved in this browser until the backend is connected. Figures are for management use and are not a substitute for audited accounts.
      </p>
    </div>
  );
}