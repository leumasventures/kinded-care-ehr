import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BedDouble, CalendarDays, FlaskConical, Pill, Receipt, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Module } from "../types/access";
import { formatNaira } from "../types/billing";
import { fmtTime, type Appointment } from "../types/appointments";
import { dashboardApi, type DashboardFinance, type DashboardOverview } from "../services/dashboard";
import { appointmentsApi } from "../services/appointment";
import { ApiError } from "../services/api";

type Icon = ComponentType<{ size?: number }>;
const num = (n: number) => n.toLocaleString("en-NG");

function Card({
  title,
  link,
  children,
  className = "",
}: {
  title: string;
  link?: { to: string; label: string } | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {link && (
          <Link to={link.to} className="text-xs font-medium text-blue-600 hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [finance, setFinance] = useState<DashboardFinance | null>(null);
  const [todays, setTodays] = useState<Appointment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const ov = await dashboardApi.overview();
        if (cancelled) return;
        setOverview(ov);

        try {
          const appts = (await appointmentsApi.list({
            date: new Date().toISOString().slice(0, 10),
            limit: 50,
          })) ?? [];
          if (!cancelled) {
            setTodays(
              (Array.isArray(appts) ? appts : []).filter(
                (a) => a && a.status !== "Cancelled" && a.status !== "No-show"
              )
            );
          }
        } catch {
          if (!cancelled) setTodays([]);
        }

        if (can("Billing", "view")) {
          try {
            const fin = await dashboardApi.money();
            if (!cancelled) setFinance(fin);
          } catch {
            /* optional */
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [can]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0];

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading dashboard…</div>;
  if (error) {
    return (
      <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!overview) return null;

  const list = Array.isArray(todays) ? todays : [];
  const remaining = list.filter((a) => a.status === "Scheduled" || a.status === "Checked in");
  const completedToday = list.filter((a) => a.status === "Completed").length;
  const labOpen =
    (overview.laboratory?.waitingCollection ?? 0) + (overview.laboratory?.waitingResults ?? 0);
  const dutyTotal = Object.values(overview.onDutyToday ?? {}).reduce((s, n) => s + n, 0);

  const stats: {
    label: string;
    value: string;
    sub: string;
    icon: Icon;
    color: string;
    module: Module;
    to: string;
  }[] = [
    {
      label: "Total Patients",
      value: num(overview.patients ?? 0),
      sub: "Registered",
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      module: "Patients",
      to: "/patients",
    },
    {
      label: "Today's Appointments",
      value: num(overview.appointmentsToday?.total ?? 0),
      sub: `${remaining.length} still to come · ${completedToday} completed`,
      icon: CalendarDays,
      color: "bg-emerald-50 text-emerald-600",
      module: "Appointments",
      to: "/appointments",
    },
    {
      label: "Admitted Patients",
      value: num(overview.admitted?.total ?? 0),
      sub:
        (overview.admitted?.byWard ?? []).map((w) => `${w.ward}: ${w.occupied}`).join(" · ") ||
        "No wards",
      icon: BedDouble,
      color: "bg-amber-50 text-amber-600",
      module: "Admissions",
      to: "/admissions",
    },
  ];

  if (finance) {
    stats.push({
      label: "Pending Bills",
      value: formatNaira(finance.outstanding?.amount ?? 0),
      sub: `${finance.outstanding?.overdueInvoices ?? 0} overdue (${formatNaira(
        finance.outstanding?.overdueAmount ?? 0
      )})`,
      icon: Receipt,
      color: "bg-rose-50 text-rose-600",
      module: "Billing",
      to: "/billing",
    });
  }

  const alerts: { text: string; to: string; module: Module }[] = [];
  if (finance && (finance.outstanding?.overdueInvoices ?? 0) > 0) {
    alerts.push({
      text: `${finance.outstanding.overdueInvoices} overdue invoice(s) totalling ${formatNaira(
        finance.outstanding.overdueAmount ?? 0
      )}`,
      to: "/billing",
      module: "Billing",
    });
  }
  if ((overview.laboratory?.criticalToReview ?? 0) > 0) {
    alerts.push({
      text: `${overview.laboratory.criticalToReview} critical lab result(s) to review`,
      to: "/laboratory",
      module: "Laboratory",
    });
  } else if (labOpen > 0) {
    alerts.push({ text: `${labOpen} open lab order(s)`, to: "/laboratory", module: "Laboratory" });
  }
  if ((overview.pharmacy?.lowStockDrugs ?? 0) > 0) {
    alerts.push({
      text: `${overview.pharmacy.lowStockDrugs} drug(s) low or out of stock`,
      to: "/pharmacy",
      module: "Pharmacy",
    });
  }
  if ((overview.pharmacy?.pendingPrescriptions ?? 0) > 0) {
    alerts.push({
      text: `${overview.pharmacy.pendingPrescriptions} prescription(s) pending dispense`,
      to: "/pharmacy",
      module: "Pharmacy",
    });
  }
  const visibleAlerts = alerts.filter((a) => can(a.module, "view"));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Hospital operations for {overview.date}</p>
      </div>

      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((a) => (
            <Link
              key={a.text}
              to={a.to}
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
            >
              <AlertTriangle size={16} className="shrink-0" />
              {a.text}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats
          .filter((s) => can(s.module, "view"))
          .map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{s.sub}</p>
                </div>
                <span className={`rounded-lg p-2 ${s.color}`}>
                  <s.icon size={20} />
                </span>
              </div>
            </Link>
          ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {can("Appointments", "view") && (
          <Card
            title={remaining.length > 0 ? "Upcoming Appointments Today" : "Today's Appointments"}
            link={{ to: "/appointments", label: "View all" }}
            className="lg:col-span-2"
          >
            <ul className="divide-y divide-slate-100">
              {(remaining.length ? remaining : list).slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-16 text-sm font-medium text-blue-600">{fmtTime(a.time)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{a.patient}</p>
                    <p className="text-xs text-slate-500">{a.doctor}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{a.type}</span>
                  <span className="hidden w-20 text-right text-xs text-slate-500 sm:block">{a.status}</span>
                </li>
              ))}
              {list.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-400">No appointments today.</li>
              )}
            </ul>
          </Card>
        )}

        {can("Admissions", "view") && (
          <Card title="Ward occupancy" link={{ to: "/admissions", label: "Admissions" }}>
            <div className="space-y-3 p-5">
              {(overview.admitted?.byWard ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No admitted patients.</p>
              )}
              {(overview.admitted?.byWard ?? []).map((w) => (
                <div key={w.ward} className="flex justify-between text-sm">
                  <span className="text-slate-700">{w.ward}</span>
                  <span className="font-medium text-slate-900">{w.occupied} occupied</span>
                </div>
              ))}
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                {overview.admitted?.total ?? 0} admitted · {dutyTotal} on duty today
              </p>
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {can("Laboratory", "view") && (
          <Card title="Laboratory" link={{ to: "/laboratory", label: "Open" }}>
            <div className="flex items-center gap-3 p-5">
              <FlaskConical size={20} className="text-violet-600" />
              <div className="text-sm">
                <p className="font-medium text-slate-800">{labOpen} open orders</p>
                <p className="text-slate-500">{overview.laboratory?.resultsToReview ?? 0} to review</p>
              </div>
            </div>
          </Card>
        )}
        {can("Pharmacy", "view") && (
          <Card title="Pharmacy" link={{ to: "/pharmacy", label: "Open" }}>
            <div className="flex items-center gap-3 p-5">
              <Pill size={20} className="text-teal-600" />
              <div className="text-sm">
                <p className="font-medium text-slate-800">
                  {overview.pharmacy?.pendingPrescriptions ?? 0} pending Rx
                </p>
                <p className="text-slate-500">{overview.pharmacy?.lowStockDrugs ?? 0} low stock</p>
              </div>
            </div>
          </Card>
        )}
        {finance && can("Billing", "view") && (
          <Card title="Collected this month" link={{ to: "/billing", label: "Billing" }}>
            <div className="p-5">
              <p className="text-2xl font-semibold text-slate-900">
                {formatNaira(finance.collectedThisMonth ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Today: {formatNaira(finance.collectedToday?.total ?? 0)}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
