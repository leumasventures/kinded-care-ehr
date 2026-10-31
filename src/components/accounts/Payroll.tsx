import { useState, type FormEvent, type ReactNode } from "react";
import { FileText, Pencil, Plus, Power } from "lucide-react";
import Modal from "../billing/Modal";
import { formatDate, formatNaira, todayISO } from "../../types/billing";
import {
  monthLabel,
  monthOf,
  payLine,
  round2,
  runTotals,
  uid,
  type Employee,
  type PayLine,
  type PayrollRun,
  type Txn,
} from "../../types/account";
import type { Ledger } from "./useLedger";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const cellInput = "w-24 rounded border border-slate-200 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

const num = (v: string) => (v === "" ? 0 : Number(v));

function EmployeeForm({ employee, ledger, onClose }: { employee: Employee | null; ledger: Ledger; onClose: () => void }) {
  const { data, commit } = ledger;
  const [f, setF] = useState({
    name: employee?.name ?? "",
    title: employee?.title ?? "",
    department: employee?.department ?? "",
    bankName: employee?.bankName ?? "",
    accountNumber: employee?.accountNumber ?? "",
    basic: String(employee?.basic ?? ""),
    housing: String(employee?.housing ?? 0),
    transport: String(employee?.transport ?? 0),
    otherAllowance: String(employee?.otherAllowance ?? 0),
    pensionPct: String(employee?.pensionPct ?? 8),
    paye: String(employee?.paye ?? 0),
    otherDeduction: String(employee?.otherDeduction ?? 0),
  });
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const preview = payLine({
    id: "", name: "", title: "", department: "", bankName: "", accountNumber: "", active: true,
    basic: num(f.basic), housing: num(f.housing), transport: num(f.transport), otherAllowance: num(f.otherAllowance),
    pensionPct: num(f.pensionPct), paye: num(f.paye), otherDeduction: num(f.otherDeduction),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const nums = [f.basic, f.housing, f.transport, f.otherAllowance, f.pensionPct, f.paye, f.otherDeduction].map(Number);
    if (!f.name.trim()) return setError("Enter the staff member's name.");
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return setError("Amounts must be numbers, zero or more.");
    if (num(f.basic) <= 0) return setError("Enter the basic salary.");
    if (num(f.pensionPct) > 100) return setError("Pension % must be between 0 and 100.");
    if (f.accountNumber.trim() && !/^\d{10}$/.test(f.accountNumber.trim())) return setError("Account numbers have 10 digits. Leave blank if not known.");
    if (preview.net < 0) return setError("Deductions are more than the gross pay.");
    const next: Employee = {
      id: employee?.id ?? `EMP-${String(data.employees.length + 1).padStart(3, "0")}-${uid().slice(0, 3)}`,
      name: f.name.trim(),
      title: f.title.trim(),
      department: f.department.trim(),
      bankName: f.bankName.trim(),
      accountNumber: f.accountNumber.trim(),
      basic: num(f.basic),
      housing: num(f.housing),
      transport: num(f.transport),
      otherAllowance: num(f.otherAllowance),
      pensionPct: num(f.pensionPct),
      paye: num(f.paye),
      otherDeduction: num(f.otherDeduction),
      active: employee?.active ?? true,
    };
    // TODO: POST/PUT /employees via a services/ call
    commit({ ...data, employees: employee ? data.employees.map((x) => (x.id === employee.id ? next : x)) : [...data.employees, next] });
    onClose();
  };

  return (
    <Modal title={employee ? `Edit ${employee.name}` : "Add Staff Member"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name"><input className={inputClass} value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
          <Field label="Job title"><input className={inputClass} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Department"><input className={inputClass} value={f.department} onChange={(e) => set("department", e.target.value)} /></Field>
          <Field label="Bank"><input className={inputClass} value={f.bankName} onChange={(e) => set("bankName", e.target.value)} /></Field>
          <Field label="Account number"><input inputMode="numeric" className={inputClass} value={f.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Basic (₦/month)"><input type="number" min="0" className={inputClass} value={f.basic} onChange={(e) => set("basic", e.target.value)} /></Field>
          <Field label="Housing"><input type="number" min="0" className={inputClass} value={f.housing} onChange={(e) => set("housing", e.target.value)} /></Field>
          <Field label="Transport"><input type="number" min="0" className={inputClass} value={f.transport} onChange={(e) => set("transport", e.target.value)} /></Field>
          <Field label="Other allowances"><input type="number" min="0" className={inputClass} value={f.otherAllowance} onChange={(e) => set("otherAllowance", e.target.value)} /></Field>
          <Field label="Pension (%)"><input type="number" min="0" max="100" step="0.5" className={inputClass} value={f.pensionPct} onChange={(e) => set("pensionPct", e.target.value)} /></Field>
          <Field label="PAYE tax (₦/month)"><input type="number" min="0" className={inputClass} value={f.paye} onChange={(e) => set("paye", e.target.value)} /></Field>
          <Field label="Other deductions" className="sm:col-span-2"><input type="number" min="0" className={inputClass} value={f.otherDeduction} onChange={(e) => set("otherDeduction", e.target.value)} /></Field>
        </div>
        <p className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Gross {formatNaira(preview.gross)} · Pension {formatNaira(preview.pension)} · Net pay <span className="font-semibold text-slate-800">{formatNaira(preview.net)}</span>
        </p>
        <p className="text-xs text-slate-400">Pension is worked out on basic + housing + transport. PAYE is entered by you from your own tax computation (confirm with your accountant or the state internal revenue service).</p>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">{employee ? "Save" : "Add staff"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentDialog({
  title,
  amount,
  note,
  ledger,
  onConfirm,
  onClose,
}: {
  title: string;
  amount: number;
  note: string;
  ledger: Ledger;
  onConfirm: (accountId: string, date: string) => void;
  onClose: () => void;
}) {
  const accounts = ledger.data.accounts.filter((a) => a.active);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");

  const confirm = () => {
    if (!accountId) return setError("Choose the account the money comes from.");
    if (!date || date > todayISO()) return setError("Choose a date that is not in the future.");
    const bal = ledger.balances[accountId] ?? 0;
    if (bal < amount && !window.confirm(`${ledger.accountName(accountId)} has ${formatNaira(bal)}, less than ${formatNaira(amount)}. Record it anyway?`)) return;
    onConfirm(accountId, date);
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">{note}</p>
        <p className="text-2xl font-semibold text-slate-800">{formatNaira(amount)}</p>
        <Field label="Paid from">
          <select className={inputClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatNaira(ledger.balances[a.id] ?? 0)})</option>
            ))}
          </select>
        </Field>
        <Field label="Date paid"><input type="date" className={inputClass} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
        {error && <p role="alert" className="text-rose-600">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={confirm} className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700">Confirm payment</button>
        </div>
      </div>
    </Modal>
  );
}

function Payslip({ line, run, onClose }: { line: PayLine; run: PayrollRun; onClose: () => void }) {
  const row = (label: string, value: number, strong = false) => (
    <div className={`flex justify-between py-1.5 ${strong ? "font-semibold text-slate-800" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{formatNaira(value)}</span>
    </div>
  );
  return (
    <Modal title={`Payslip · ${monthLabel(run.month)}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div>
          <p className="font-medium text-slate-800">{line.name}</p>
          <p className="text-xs text-slate-500">{line.title}</p>
        </div>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-4">
          {row("Basic salary", line.basic)}
          {row("Allowances", line.allowances)}
          {line.bonus > 0 && row("Bonus / overtime", line.bonus)}
          {row("Gross pay", line.gross, true)}
          {row("Pension (employee)", -line.pension)}
          {row("PAYE tax", -line.paye)}
          {line.other > 0 && row("Other deductions", -line.other)}
          {row("Net pay", line.net, true)}
        </div>
        <p className="text-xs text-slate-500">
          {run.status === "Paid" ? `Paid ${run.paidOn ? formatDate(run.paidOn) : ""}.` : "Not yet paid (draft)."}
        </p>
      </div>
    </Modal>
  );
}

export default function Payroll({ ledger }: { ledger: Ledger }) {
  const { data, commit, can, me, accountName } = ledger;
  const [employee, setEmployee] = useState<Employee | "new" | null>(null);
  const [month, setMonth] = useState(monthOf(todayISO()));
  const [paying, setPaying] = useState(false);
  const [remitting, setRemitting] = useState(false);
  const [slip, setSlip] = useState<PayLine | null>(null);

  const run = data.runs.find((r) => r.month === month);
  const totals = run ? runTotals(run) : null;
  const active = data.employees.filter((e) => e.active);
  const monthsToPick = Array.from(new Set([monthOf(todayISO()), ...data.runs.map((r) => r.month)])).sort().reverse();

  const updateRun = (next: PayrollRun) => commit({ ...data, runs: data.runs.map((r) => (r.id === next.id ? next : r)) });

  const startRun = () => {
    if (active.length === 0) return;
    // TODO: POST /payroll via a services/ call
    commit({ ...data, runs: [...data.runs, { id: uid(), month, status: "Draft", lines: active.map((e) => payLine(e)) }] });
  };

  const editLine = (employeeId: string, field: "bonus" | "paye" | "other", value: number) => {
    if (!run || run.status !== "Draft") return;
    updateRun({
      ...run,
      lines: run.lines.map((l) => {
        if (l.employeeId !== employeeId) return l;
        const next = { ...l, [field]: Math.max(0, value) };
        const gross = round2(l.basic + l.allowances + next.bonus);
        return { ...next, gross, net: round2(gross - next.pension - next.paye - next.other) };
      }),
    });
  };

  const removeRun = () => {
    if (!run || run.status !== "Draft" || !window.confirm(`Discard the draft payroll for ${monthLabel(run.month)}?`)) return;
    commit({ ...data, runs: data.runs.filter((r) => r.id !== run.id) });
  };

  const pay = (accountId: string, date: string) => {
    if (!run || !totals) return;
    const txn: Txn = {
      id: uid(), date, type: "Expense", category: "Salaries & wages",
      description: `Payroll for ${monthLabel(run.month)} (${run.lines.length} staff)`, party: "Staff", reference: "",
      amount: totals.net, accountId, source: "payroll", recordedBy: me, recordedAt: Date.now(),
    };
    // TODO: POST /payroll/:id/pay via a services/ call
    commit({
      ...data,
      txns: [...data.txns, txn],
      runs: data.runs.map((r) => (r.id === run.id ? { ...r, status: "Paid", paidOn: date, paidFromAccountId: accountId, paidBy: me, txnId: txn.id } : r)),
    });
    setPaying(false);
  };

  const remit = (accountId: string, date: string) => {
    if (!run || !totals) return;
    const txn: Txn = {
      id: uid(), date, type: "Expense", category: "Taxes, pension & levies",
      description: `PAYE and pension remittance for ${monthLabel(run.month)}`, party: "Tax authority and pension administrators", reference: "",
      amount: round2(totals.paye + totals.pension), accountId, source: "manual", recordedBy: me, recordedAt: Date.now(),
    };
    commit({
      ...data,
      txns: [...data.txns, txn],
      runs: data.runs.map((r) => (r.id === run.id ? { ...r, remittedOn: date, remittanceTxnId: txn.id } : r)),
    });
    setRemitting(false);
  };

  const toggleEmployee = (e: Employee) =>
    commit({ ...data, employees: data.employees.map((x) => (x.id === e.id ? { ...x, active: !x.active } : x)) });

  const blocked = run?.lines.some((l) => l.net < 0);

  return (
    <div className="space-y-8">
      {/* Payroll run */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-800">Payroll</h2>
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Payroll month" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              {monthsToPick.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            {run && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${run.status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{run.status}</span>}
          </div>
          {!run && can.create && (
            <button onClick={startRun} disabled={active.length === 0} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40">
              <Plus size={16} /> Start payroll for {monthLabel(month)}
            </button>
          )}
        </div>

        {!run && <p className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-400">No payroll for {monthLabel(month)} yet. Starting one takes the current pay details of {active.length} active staff.</p>}

        {run && totals && (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ["Gross pay", totals.gross],
                ["Deductions", round2(totals.pension + totals.paye + totals.other)],
                ["Net pay (cash out)", totals.net],
                ["PAYE + pension to remit", round2(totals.paye + totals.pension)],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">{formatNaira(value as number)}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3 text-right">Basic</th>
                    <th className="px-4 py-3 text-right">Allowances</th>
                    <th className="px-4 py-3 text-right">Bonus</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Pension</th>
                    <th className="px-4 py-3 text-right">PAYE</th>
                    <th className="px-4 py-3 text-right">Other</th>
                    <th className="px-4 py-3 text-right">Net pay</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {run.lines.map((l) => {
                    const editable = run.status === "Draft" && can.create;
                    return (
                      <tr key={l.employeeId}>
                        <td className="px-4 py-2"><p className="font-medium text-slate-800">{l.name}</p><p className="text-xs text-slate-500">{l.title}</p></td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatNaira(l.basic)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatNaira(l.allowances)}</td>
                        <td className="px-4 py-2 text-right">{editable ? <input type="number" min="0" className={cellInput} value={l.bonus} onChange={(e) => editLine(l.employeeId, "bonus", num(e.target.value))} aria-label={`Bonus for ${l.name}`} /> : formatNaira(l.bonus)}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{formatNaira(l.gross)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatNaira(l.pension)}</td>
                        <td className="px-4 py-2 text-right">{editable ? <input type="number" min="0" className={cellInput} value={l.paye} onChange={(e) => editLine(l.employeeId, "paye", num(e.target.value))} aria-label={`PAYE for ${l.name}`} /> : formatNaira(l.paye)}</td>
                        <td className="px-4 py-2 text-right">{editable ? <input type="number" min="0" className={cellInput} value={l.other} onChange={(e) => editLine(l.employeeId, "other", num(e.target.value))} aria-label={`Other deductions for ${l.name}`} /> : formatNaira(l.other)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${l.net < 0 ? "text-rose-600" : "text-slate-800"}`}>{formatNaira(l.net)}</td>
                        <td className="px-4 py-2 text-right"><button onClick={() => setSlip(l)} title="Payslip" aria-label={`Payslip for ${l.name}`} className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><FileText size={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {run.status === "Draft" ? (
              can.edit && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{blocked ? "A deduction is more than someone's gross pay. Fix it before paying." : "Adjust bonus, PAYE and other deductions for this month, then pay. Paying posts one expense for the net total."}</p>
                  <div className="flex gap-2">
                    {can.create && <button onClick={removeRun} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Discard draft</button>}
                    <button onClick={() => setPaying(true)} disabled={blocked} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">Pay salaries</button>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p>Paid {run.paidOn && formatDate(run.paidOn)} from {accountName(run.paidFromAccountId)} by {run.paidBy}.</p>
                {run.remittedOn ? (
                  <p>PAYE and pension of {formatNaira(round2(totals.paye + totals.pension))} remitted {formatDate(run.remittedOn)}.</p>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>{formatNaira(round2(totals.paye + totals.pension))} of PAYE and pension is still to be remitted.</p>
                    {can.edit && <button onClick={() => setRemitting(true)} className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50">Record remittance</button>}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Staff */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-800">Staff pay details ({active.length} active)</h2>
          {can.edit && <button onClick={() => setEmployee("new")} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Plus size={16} /> Add staff</button>}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Bank</th>
                <th className="px-4 py-3 text-right">Gross / month</th>
                <th className="px-4 py-3 text-right">Net / month</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.employees.map((e) => {
                const l = payLine(e);
                return (
                  <tr key={e.id} className={e.active ? "" : "text-slate-400"}>
                    <td className="px-4 py-2"><p className="font-medium text-slate-800">{e.name}</p><p className="text-xs text-slate-500">{e.title}</p></td>
                    <td className="px-4 py-2">{e.department}</td>
                    <td className="px-4 py-2 text-xs">{e.bankName}{e.accountNumber && ` · ${e.accountNumber}`}</td>
                    <td className="px-4 py-2 text-right">{formatNaira(l.gross)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatNaira(l.net)}</td>
                    <td className="px-4 py-2 text-right">
                      {can.edit && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setEmployee(e)} aria-label={`Edit ${e.name}`} title="Edit" className="rounded-md p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Pencil size={15} /></button>
                          <button onClick={() => toggleEmployee(e)} aria-label={`${e.active ? "Deactivate" : "Activate"} ${e.name}`} title={e.active ? "Remove from future payrolls" : "Include in payrolls"} className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"><Power size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">Changes here apply to payrolls started afterwards. A payroll already started keeps the figures it was created with.</p>
      </section>

      {employee && <EmployeeForm employee={employee === "new" ? null : employee} ledger={ledger} onClose={() => setEmployee(null)} />}
      {paying && totals && run && (
        <PaymentDialog title="Pay salaries" amount={totals.net} note={`Net pay for ${run.lines.length} staff, ${monthLabel(run.month)}. This can't be undone.`} ledger={ledger} onConfirm={pay} onClose={() => setPaying(false)} />
      )}
      {remitting && totals && run && (
        <PaymentDialog title="Record remittance" amount={round2(totals.paye + totals.pension)} note={`PAYE and employee pension deducted in ${monthLabel(run.month)}.`} ledger={ledger} onConfirm={remit} onClose={() => setRemitting(false)} />
      )}
      {slip && run && <Payslip line={slip} run={run} onClose={() => setSlip(null)} />}
    </div>
  );
}