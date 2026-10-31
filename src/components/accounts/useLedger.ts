import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { diffById, logAudit } from "../../services/audit";
import { formatNaira } from "../../types/billing";
import { balanceOfAccount, billingTxns, loadAccounts, saveAccounts, type AccountsData, type Txn } from "../../types/account";

export function useLedger() {
  const { user, can } = useAuth();
  const [data, setData] = useState<AccountsData>(loadAccounts);

  // Records every change to accounts, transactions and payroll for the audit log.
  const audit = (prev: AccountsData, next: AccountsData) => {
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const t = diffById(prev.txns, next.txns, same);
    t.created.forEach((x) =>
      logAudit({
        action: x.source === "payroll" ? "Payment" : "Create",
        module: "Accounts",
        summary: `${x.source === "payroll" ? "Paid salaries: " : `Recorded ${x.type.toLowerCase()}: `}${formatNaira(x.amount)} ${x.category.toLowerCase()}`,
        detail: `${x.description}${x.party ? `\nParty: ${x.party}` : ""}${x.reference ? `\nReference: ${x.reference}` : ""}`,
      })
    );
    t.updated.forEach((x) => {
      if (x.voided) logAudit({ action: "Void", module: "Accounts", summary: `Voided ${x.type.toLowerCase()} of ${formatNaira(x.amount)} (${x.description})`, detail: `Reason: ${x.voided.reason}` });
    });
    const a = diffById(prev.accounts, next.accounts, same);
    a.created.forEach((x) => logAudit({ action: "Create", module: "Accounts", summary: `Registered account ${x.name}`, detail: `Opening balance ${formatNaira(x.opening)}` }));
    a.updated.forEach((x) => {
      const old = prev.accounts.find((y) => y.id === x.id);
      logAudit({ action: "Update", module: "Accounts", summary: old && old.active !== x.active ? `${x.active ? "Activated" : "Deactivated"} account ${x.name}` : `Updated account ${x.name}` });
    });
    const e = diffById(prev.employees, next.employees, same);
    e.created.forEach((x) => logAudit({ action: "Create", module: "Payroll", summary: `Added staff member ${x.name} to payroll` }));
    e.updated.forEach((x) => logAudit({ action: "Update", module: "Payroll", summary: `Changed pay details of ${x.name}` }));
    const r = diffById(prev.runs, next.runs, same);
    r.created.forEach((x) => logAudit({ action: "Create", module: "Payroll", summary: `Started payroll for ${x.month}`, detail: `${x.lines.length} staff` }));
    r.deleted.forEach((x) => logAudit({ action: "Delete", module: "Payroll", summary: `Discarded draft payroll for ${x.month}` }));
    r.updated.forEach((x) => {
      const old = prev.runs.find((y) => y.id === x.id);
      if (!old) return;
      if (old.status !== x.status) logAudit({ action: "Payment", module: "Payroll", summary: `Marked payroll for ${x.month} as paid` });
      else if (!old.remittedOn && x.remittedOn) logAudit({ action: "Payment", module: "Payroll", summary: `Recorded PAYE and pension remittance for ${x.month}` });
      else logAudit({ action: "Update", module: "Payroll", summary: `Adjusted draft payroll for ${x.month}`, dedupeMs: 60_000 });
    });
  };

  const commit = (next: AccountsData) => {
    audit(data, next);
    setData(next);
    saveAccounts(next);
  };

  // Patient payments are read from Billing and shown alongside manual entries.
  const txns = useMemo<Txn[]>(() => [...billingTxns(), ...data.txns].sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt - a.recordedAt), [data.txns]);
  const balances = useMemo(() => Object.fromEntries(data.accounts.map((a) => [a.id, balanceOfAccount(a, txns)])), [data.accounts, txns]);
  const accountName = (id?: string) => data.accounts.find((a) => a.id === id)?.name ?? "—";

  return {
    data,
    commit,
    txns,
    balances,
    accountName,
    me: user?.name ?? "Unknown user",
    can: {
      create: can("Accounts", "create"),
      edit: can("Accounts", "edit"),
      remove: can("Accounts", "delete"),
    },
  };
}

export type Ledger = ReturnType<typeof useLedger>;