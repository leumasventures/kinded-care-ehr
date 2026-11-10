import { useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { Module } from "../../types/access";
import { EmergencyDialog } from "./EmergencyAccess";

interface ProtectedRouteProps {
  /** Require view access to this module. */
  module?: Module;
  /** Require the Administrator role. */
  adminOnly?: boolean;
  /** If omitted, renders nested routes through <Outlet />. */
  children?: ReactNode;
}

export default function ProtectedRoute({ module, adminOnly, children }: ProtectedRouteProps) {
  const { user, can } = useAuth();
  const location = useLocation();
  const [asking, setAsking] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const denied = (adminOnly && !user.isAdmin) || (module && !can(module));

  if (denied) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <ShieldAlert size={32} className="mx-auto text-amber-500" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">Access denied</h2>
        <p className="mt-1 text-sm text-slate-500">
          Your role ({user.roleName}) doesn't have permission to view this page.
        </p>
        {module === "Patients" && (
          <>
            <p className="mt-4 text-sm text-slate-500">If a patient needs urgent care and you need their record, you can open it for a short time. This is recorded.</p>
            <button onClick={() => setAsking(true)} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">Emergency access</button>
            {asking && <EmergencyDialog onClose={() => setAsking(false)} />}
          </>
        )}
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}