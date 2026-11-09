import { useMemo, useState, type ReactNode } from "react";
import { Download, Info } from "lucide-react";
import {
  balanceOf,
  calcTotals,
  formatDate,
  formatNaira,
  paidTotal,
  loadInvoices,
  statusOf,
  todayISO,
} from "../types/billing";
import { loadPriceList } from "../types/pricing";
import {
  DIAGNOSIS_SHARES,
  PRESETS,
  buildClinicalData,
  downloadCsv,
  rangeForPreset,
  type Preset,
} from "../types/reports";

type Tab = "financial" | "clinical";

const inputClass =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function StatCard({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-800">{title}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

function BarRow({ label, value, max, display }: { label: string; value: number; max: number; display: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-sm">
        <span className="truncate text-slate-700">{label}</span>
        <span className="shrink-0 text-slate-500">{display}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-4 text-center text-sm text-slate-400">No data for this period.</p>;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
      <Info size={16} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>("financial");
  const [preset, setPreset] = useState<Preset>("30d");
  const [{ from, to }, setRange] = useState(() => rangeForPreset("30d"));

  const choosePreset = (p: Exclude<Preset, "custom">) => {
    setPreset(p);
    setRange(rangeForPreset(p));
  };

  const changeDate = (key: "from" | "to", value: string) => {
    if (!value) return;
    setPreset("custom");
    setRange((r) => {
      const next = { ...r, [key]: value };
      // keep the range valid
      return next.from > next.to ? { from: value, to: value } : next;
    });
  };

  // ---------- Financial (from invoice records) ----------
  const financial = useMemo(() => {
    const priceCategory = new Map(loadPriceList().map((p) => [p.name.toLowerCase(), p.category as string]));

    const invoices = loadInvoices().filter((i) => i.date >= from && i.date <= to);
    const payments = loadInvoices()
      .flatMap((i) => i.payments.map((p) => ({ ...p, invoice: i })))
      .filter((p) => p.date >= from && p.date <= to);

    const billed = invoices.reduce((s, i) => s + calcTotals(i).total, 0);
    const collected = payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = invoices.reduce((s, i) => s + balanceOf(i), 0);

    const byMethod = new Map<string, number>();
    payments.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount));

    const byCategory = new Map<string, number>();
    invoices.forEach((i) =>
      i.items.forEach((it) => {
        const cat = priceCategory.get(it.description.toLowerCase()) ?? "Other / custom items";
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + it.qty * it.unitPrice);
      })
    );

    const byDay = new Map<string, number>();
    payments.forEach((p) => byDay.set(p.date, (byDay.get(p.date) ?? 0) + p.amount));

    const owing = invoices
      .filter((i) => balanceOf(i) > 0)
      .sort((a, b) => balanceOf(b) - balanceOf(a));

    const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

    return {
      invoices,
      billed,
      collected,
      outstanding,
      methods: sortDesc(byMethod),
      categories: sortDesc(byCategory),
      days: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      owing,
    };
  }, [from, to]);

  // ---------- Clinical (sample data) ----------
  const clinical = useMemo(() => {
    const days = buildClinicalData().filter((d) => d.date >= from && d.date <= to);
    const sum = (k: "visits" | "newPatients" | "appointments" | "completed" | "cancelled" | "admissions" | "discharges" | "labTests") =>
      days.reduce((s, d) => s + d[k], 0);
    const visits = sum("visits");
    return {
      days,
      visits,
      newPatients: sum("newPatients"),
      appointments: sum("appointments"),
      completed: sum("completed"),
      cancelled: sum("cancelled"),
      admissions: sum("admissions"),
      discharges: sum("discharges"),
      labTests: sum("labTests"),
      diagnoses: DIAGNOSIS_SHARES.map(([name, share]) => [name, Math.round(visits * share)] as [string, number]),
    };
  }, [from, to]);

  const exportCsv = () => {
    const stamp = `${from}_to_${to}`;
    if (tab === "financial") {
      downloadCsv(`financial-report_${stamp}.csv`, [
        ["Invoice", "Patient", "Date", "Due date", "Total (NGN)", "Paid (NGN)", "Balance (NGN)", "Status"],
        ...financial.invoices.map((i) => [
          i.number,
          i.patient,
          i.date,
          i.dueDate,
          calcTotals(i).total,
          paidTotal(i),
          balanceOf(i),
          statusOf(i),
        ]),
      ]);
    } else {
      downloadCsv(`clinical-report_${stamp}.csv`, [
        ["Date", "Visits", "New patients", "Appointments", "Completed", "Cancelled", "Admissions", "Discharges", "Lab tests"],
        ...clinical.days.map((d) => [
          d.date,
          d.visits,
          d.newPatients,
          d.appointments,
          d.completed,
          d.cancelled,
          d.admissions,
          d.discharges,
          d.labTests,
        ]),
      ]);
    }
  };

  const maxDay = Math.max(0, ...financial.days.map(([, v]) => v));
  const maxVisits = Math.max(0, ...clinical.days.map((d) => d.visits));

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ["financial", "Financial"],
              ["clinical", "Clinical activity"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                tab === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={exportCsv}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => choosePreset(p.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                preset === p.id ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <input type="date" className={inputClass} value={from} max={todayISO()} onChange={(e) => changeDate("from", e.target.value)} aria-label="From date" />
          <span>to</span>
          <input type="date" className={inputClass} value={to} max={todayISO()} onChange={(e) => changeDate("to", e.target.value)} aria-label="To date" />
        </div>
      </div>

      {tab === "financial" ? (
        <>
          <Notice>
            Based on the invoice records in the app. Totals show invoices dated in the period; collections show payments
            received in the period.
          </Notice>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Billed" value={formatNaira(financial.billed)} />
            <StatCard label="Collected" value={formatNaira(financial.collected)} tone="text-emerald-600" />
            <StatCard label="Outstanding" value={formatNaira(financial.outstanding)} tone="text-amber-600" />
            <StatCard label="Invoices" value={String(financial.invoices.length)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Billed by service category">
              {financial.categories.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-4">
                  {financial.categories.map(([cat, amount]) => (
                    <BarRow key={cat} label={cat} value={amount} max={financial.categories[0][1]} display={formatNaira(amount)} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Collections by payment method">
              {financial.methods.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-4">
                  {financial.methods.map(([m, amount]) => (
                    <BarRow key={m} label={m} value={amount} max={financial.methods[0][1]} display={formatNaira(amount)} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          <Section title="Daily collections">
            {financial.days.length === 0 ? (
              <Empty />
            ) : (
              <div className="space-y-3">
                {financial.days.map(([date, amount]) => (
                  <BarRow key={date} label={formatDate(date)} value={amount} max={maxDay} display={formatNaira(amount)} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Outstanding balances">
            {financial.owing.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">No outstanding balances in this period.</p>
            ) : (
              <div className="-m-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Invoice</th>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Due</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {financial.owing.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-blue-600">{i.number}</td>
                        <td className="px-5 py-3 text-slate-800">{i.patient}</td>
                        <td className="px-5 py-3 text-slate-600">{formatDate(i.dueDate)}</td>
                        <td className="px-5 py-3 text-slate-600">{statusOf(i)}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-800">{formatNaira(balanceOf(i))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      ) : (
        <>
          <Notice>
            Clinical figures are sample data until the app is connected to the backend. The layout and filters are final.
          </Notice>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Patient visits" value={clinical.visits.toLocaleString()} />
            <StatCard label="New patients" value={clinical.newPatients.toLocaleString()} />
            <StatCard label="Admissions" value={clinical.admissions.toLocaleString()} />
            <StatCard label="Lab tests" value={clinical.labTests.toLocaleString()} />
          </div>

          <Section title="Daily patient visits">
            {clinical.days.length === 0 ? (
              <Empty />
            ) : (
              <>
                <div className="flex h-40 items-end gap-px">
                  {clinical.days.map((d) => (
                    <div
                      key={d.date}
                      title={`${formatDate(d.date)}: ${d.visits} visits`}
                      className="min-w-px flex-1 rounded-t bg-blue-500 hover:bg-blue-700"
                      style={{ height: `${maxVisits ? Math.max(3, (d.visits / maxVisits) * 100) : 0}%` }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-400">
                  <span>{formatDate(clinical.days[0].date)}</span>
                  <span>{formatDate(clinical.days[clinical.days.length - 1].date)}</span>
                </div>
              </>
            )}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Appointments">
              {clinical.appointments === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-4">
                  <BarRow label="Completed" value={clinical.completed} max={clinical.appointments} display={String(clinical.completed)} />
                  <BarRow label="Cancelled" value={clinical.cancelled} max={clinical.appointments} display={String(clinical.cancelled)} />
                  <p className="text-xs text-slate-500">
                    {clinical.appointments} booked ·{" "}
                    {Math.round((clinical.cancelled / clinical.appointments) * 100)}% cancellation rate
                  </p>
                </div>
              )}
            </Section>

            <Section title="Top diagnoses (OPD)">
              {clinical.visits === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-4">
                  {clinical.diagnoses.map(([name, count]) => (
                    <BarRow
                      key={name}
                      label={name}
                      value={count}
                      max={Math.max(...clinical.diagnoses.map((d) => d[1]))}
                      display={String(count)}
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}