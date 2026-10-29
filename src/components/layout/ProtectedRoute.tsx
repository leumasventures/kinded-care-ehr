import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { Module } from "../../types/access";

interface ProtectedRouteProps {
  module?: Module;
  adminOnly?: boolean;
  children?: ReactNode;
}

export default function ProtectedRoute({ module, adminOnly, children }: ProtectedRouteProps) {
  const { user, can } = useAuth();
  const location = useLocation();

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
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
