import { useMemo, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BedDouble, CalendarDays, FlaskConical, Pill, Receipt, Stethoscope, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { Module } from "../types/access";
import { seedPatients } from "../types/patients";
import { SLOTS, fmtTime, isActive, nowHHmm, seedAppointments } from "../types/appointments";
import { WARDS, seedAdmissions, stayDays } from "../types/admissions";
import { addDaysISO, balanceOf, calcTotals, formatDate, formatNaira, seedInvoices, statusOf, todayISO } from "../types/billing";
import { seedLabOrders } from "../types/laboratory";
import { isExpired, isExpiringSoon, isLow, isOut, seedDrugs } from "../types/pharmacy";
import { seedDoctors, scheduleLabel, worksToday } from "../types/doctors";

type Icon = ComponentType<{ size?: number }>;

const num = (n: number) => n.toLocaleString("en-NG");

function Card({ title, link, children, className = "" }: { title: string; link?: { to: string; label: string } | null; children: ReactNode; className?: string }) {
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

  const d = useMemo(() => {
    const today = todayISO();
    const month = today.slice(0, 7);
    const now = nowHHmm();

    // TODO: replace these seed imports with services/ calls; the page reads the same data the module pages start from.
    const todays = seedAppointments.filter((a) => a.date === today && isActive(a.status)).sort((a, b) => a.time.localeCompare(b.time));
    const remaining = todays.filter((a) => a.time >= now && (a.status === "Scheduled" || a.status === "Checked in"));
    const admitted = seedAdmissions.filter((a) => a.status === "Admitted");

    const wards = WARDS.map((w) => {
      const occupied = admitted.filter((a) => a.ward === w.name).length;
      return { name: w.name, occupied, total: w.beds, pct: Math.round((occupied / w.beds) * 100) };
    });
    const totalBeds = WARDS.reduce((s, w) => s + w.beds, 0);

    const outstanding = seedInvoices.reduce((s, i) => s + Math.max(0, balanceOf(i)), 0);
    const overdue = seedInvoices.filter((i) => statusOf(i) === "Overdue");
    const overdueAmount = overdue.reduce((s, i) => s + balanceOf(i), 0);
    const payments = seedInvoices.flatMap((i) => i.payments);
    const collectedMonth = payments.filter((p) => p.date.startsWith(month)).reduce((s, p) => s + p.amount, 0);
    const billedMonth = seedInvoices.filter((i) => i.date.startsWith(month)).reduce((s, i) => s + calcTotals(i).total, 0);

    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
    const revenue = days.map((day) => ({
      day,
      amount: payments.filter((p) => p.date === day).reduce((s, p) => s + p.amount, 0),
    }));

    const openLabs = seedLabOrders.filter((o) => o.status === "Pending" || o.status === "Sample collected" || o.status === "Processing");
    const urgentLabs = openLabs.filter((o) => o.priority === "Urgent");

    const lowStock = seedDrugs.filter((x) => isLow(x) || isOut(x));
    const outOfStock = seedDrugs.filter(isOut);
    const expired = seedDrugs.filter(isExpired);
    const expiring = seedDrugs.filter(isExpiringSoon);

    return {
      today,
      patients: seedPatients.length,
      newThisMonth: seedPatients.filter((p) => p.registeredOn.startsWith(month)).length,
      todays,
      remaining,
      completedToday: todays.filter((a) => a.status === "Completed").length,
      admitted,
      wards,
      totalBeds,
      outstanding,
      overdue,
      overdueAmount,
      collectedMonth,
      billedMonth,
      revenue,
      openLabs,
      urgentLabs,
      lowStock,
      outOfStock,
      expired,
      expiring,
    };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0];

  const stats: { label: string; value: string; sub: string; icon: Icon; color: string; module: Module; to: string }[] = [
    { label: "Total Patients", value: num(d.patients), sub: `${d.newThisMonth} new this month`, icon: Users, color: "bg-blue-50 text-blue-600", module: "Patients", to: "/patients" },
    { label: "Today's Appointments", value: num(d.todays.length), sub: `${d.remaining.length} still to come · ${d.completedToday} completed`, icon: CalendarDays, color: "bg-emerald-50 text-emerald-600", module: "Appointments", to: "/appointments" },
    { label: "Admitted Patients", value: num(d.admitted.length), sub: `${Math.round((d.admitted.length / d.totalBeds) * 100)}% of ${d.totalBeds} beds occupied`, icon: BedDouble, color: "bg-amber-50 text-amber-600", module: "Admissions", to: "/admissions" },
    { label: "Pending Bills", value: formatNaira(d.outstanding), sub: `${d.overdue.length} overdue (${formatNaira(d.overdueAmount)})`, icon: Receipt, color: "bg-rose-50 text-rose-600", module: "Billing", to: "/billing" },
  ];

  const alerts: { text: string; to: string; module: Module }[] = [];
  if (d.overdue.length) alerts.push({ text: `${d.overdue.length} overdue invoice(s) totalling ${formatNaira(d.overdueAmount)}`, to: "/billing", module: "Billing" });
  if (d.urgentLabs.length) alerts.push({ text: `${d.urgentLabs.length} urgent lab order(s) awaiting results`, to: "/laboratory", module: "Laboratory" });
  if (d.outOfStock.length) alerts.push({ text: `${d.outOfStock.length} drug(s) out of stock`, to: "/pharmacy", module: "Pharmacy" });
  else if (d.lowStock.length) alerts.push({ text: `${d.lowStock.length} drug(s) running low`, to: "/pharmacy", module: "Pharmacy" });
  if (d.expired.length) alerts.push({ text: `${d.expired.length} drug batch(es) expired`, to: "/pharmacy", module: "Pharmacy" });
  else if (d.expiring.length) alerts.push({ text: `${d.expiring.length} drug batch(es) expiring within 90 days`, to: "/pharmacy", module: "Pharmacy" });
  d.wards.filter((w) => w.pct > 85).forEach((w) => alerts.push({ text: `${w.name} is ${w.pct}% full (${w.occupied}/${w.total} beds)`, to: "/admissions", module: "Admissions" }));
  const visibleAlerts = alerts.filter((a) => can(a.module, "view"));

  const maxRevenue = Math.max(1, ...d.revenue.map((r) => r.amount));
  const listed = d.remaining.length > 0 ? d.remaining : d.todays;
  const dayName = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-NG", { weekday: "short" });
  const onDuty = seedDoctors.filter((x) => worksToday(x) && x.status !== "On Leave");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-slate-500">{formatDate(d.today)} · here's what's happening at the hospital today.</p>
      </div>

      {visibleAlerts.length > 0 && (
        <ul className="space-y-2" aria-label="Alerts">
          {visibleAlerts.map((a) => (
            <li key={a.text}>
              <Link to={a.to} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-100">
                <AlertTriangle size={16} className="shrink-0" />
                {a.text}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats
          .filter((s) => can(s.module, "view"))
          .map(({ label, value, sub, icon: IconC, color, to }) => (
            <Link key={label} to={to} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <IconC size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="truncate text-2xl font-semibold text-slate-800">{value}</p>
                <p className="text-xs text-slate-400">{sub}</p>
              </div>
            </Link>
          ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {can("Appointments", "view") && (
          <Card title={d.remaining.length > 0 ? "Upcoming Appointments Today" : "Today's Appointments"} link={{ to: "/appointments", label: "View all" }} className="lg:col-span-2">
            <ul className="divide-y divide-slate-100">
              {listed.slice(0, 6).map((a) => (
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
              {listed.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">No appointments today.</li>}
            </ul>
            {listed.length > 6 && <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">+ {listed.length - 6} more today</p>}
          </Card>
        )}

        {can("Admissions", "view") && (
          <Card title="Bed Occupancy" link={{ to: "/admissions", label: "Admissions" }}>
            <div className="space-y-4 p-5">
              {d.wards.map((w) => (
                <div key={w.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-700">{w.name}</span>
                    <span className="text-slate-500">{w.occupied}/{w.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={w.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${w.name} occupancy`}>
                    <div className={`h-2 rounded-full ${w.pct > 85 ? "bg-rose-500" : "bg-blue-600"}`} style={{ width: `${Math.min(100, w.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {can("Billing", "view") && (
          <Card title="Payments Received (7 days)" link={{ to: "/billing", label: "Billing" }} className="lg:col-span-2">
            <div className="p-5">
              <div className="flex h-36 items-end gap-3">
                {d.revenue.map((r) => (
                  <div key={r.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${formatDate(r.day)}: ${formatNaira(r.amount)}`}>
                    <span className="text-[10px] text-slate-400">{r.amount ? formatNaira(r.amount).replace(/\.00$/, "") : ""}</span>
                    <div className="w-full rounded-t bg-blue-600" style={{ height: `${Math.max(r.amount ? 4 : 0, (r.amount / maxRevenue) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-3">
                {d.revenue.map((r) => (
                  <span key={r.day} className="flex-1 text-center text-xs text-slate-500">{dayName(r.day)}</span>
                ))}
              </div>
              <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-400">Collected this month</dt><dd className="font-semibold text-slate-800">{formatNaira(d.collectedMonth)}</dd></div>
                <div><dt className="text-xs text-slate-400">Billed this month</dt><dd className="font-semibold text-slate-800">{formatNaira(d.billedMonth)}</dd></div>
              </dl>
            </div>
          </Card>
        )}

        <div className="space-y-6">
          {can("Laboratory", "view") && (
            <Card title="Laboratory" link={{ to: "/laboratory", label: "Open" }}>
              <div className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><FlaskConical size={20} /></div>
                <div>
                  <p className="text-2xl font-semibold text-slate-800">{d.openLabs.length}</p>
                  <p className="text-xs text-slate-500">open orders · {d.urgentLabs.length} urgent</p>
                </div>
              </div>
            </Card>
          )}
          {can("Pharmacy", "view") && (
            <Card title="Pharmacy" link={{ to: "/pharmacy", label: "Open" }}>
              <div className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600"><Pill size={20} /></div>
                <div>
                  <p className="text-2xl font-semibold text-slate-800">{d.lowStock.length}</p>
                  <p className="text-xs text-slate-500">low or out of stock · {d.expiring.length + d.expired.length} expiring or expired</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {can("Doctors", "view") && (
          <Card title="Doctors on Duty Today" link={{ to: "/doctors", label: "Doctors" }}>
            <ul className="divide-y divide-slate-100">
              {onDuty.map((x) => {
                const cap = SLOTS.filter((t) => t >= x.start && t < x.end).length;
                const booked = d.todays.filter((a) => a.doctor === x.name).length;
                return (
                  <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Stethoscope size={16} /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{x.name}</p>
                      <p className="text-xs text-slate-500">{x.specialty} · {scheduleLabel(x)}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className={x.status === "Available" ? "text-emerald-600" : "text-amber-600"}>{x.status}</p>
                      <p className="text-slate-400">{booked}/{cap} slots</p>
                    </div>
                  </li>
                );
              })}
              {onDuty.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">No doctors scheduled today.</li>}
            </ul>
          </Card>
        )}

        {can("Admissions", "view") && (
          <Card title="Currently Admitted" link={{ to: "/admissions", label: "Admissions" }}>
            <ul className="divide-y divide-slate-100">
              {[...d.admitted]
                .sort((a, b) => b.admittedOn.localeCompare(a.admittedOn))
                .slice(0, 5)
                .map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{a.patient}</p>
                      <p className="truncate text-xs text-slate-500">{a.diagnosis} · {a.doctor}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-500">
                      <p>{a.ward} · {a.bed}</p>
                      <p className="text-slate-400">Day {stayDays(a)}</p>
                    </div>
                  </li>
                ))}
              {d.admitted.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">No admitted patients.</li>}
            </ul>
          </Card>
        )}
      </div>

      <p className="text-xs text-slate-400">Figures come from the same data as each module page. They update live once the backend is connected.</p>
    </div>
  );
}