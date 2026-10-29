import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import Doctors from "./pages/Doctors";
import Laboratory from "./pages/Laboratory";
import Pharmacy from "./pages/Pharmacy";
import Nursing from "./pages/Nursing";
import Admissions from "./pages/Admissions";
import Billing from "./pages/Billing";
import PriceList from "./pages/PriceList";
import Reports from "./pages/Report";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Users from "./pages/Users";
import Roles from "./pages/Roles";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Everything below requires a logged-in user */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/patients" element={<ProtectedRoute module="Patients"><Patients /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute module="Appointments"><Appointments /></ProtectedRoute>} />
          <Route path="/doctors" element={<ProtectedRoute module="Doctors"><Doctors /></ProtectedRoute>} />
          <Route path="/laboratory" element={<ProtectedRoute module="Laboratory"><Laboratory /></ProtectedRoute>} />
          <Route path="/pharmacy" element={<ProtectedRoute module="Pharmacy"><Pharmacy /></ProtectedRoute>} />
          <Route path="/nursing" element={<ProtectedRoute module="Nursing"><Nursing /></ProtectedRoute>} />
          <Route path="/admissions" element={<ProtectedRoute module="Admissions"><Admissions /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute module="Billing"><Billing /></ProtectedRoute>} />
          <Route path="/price-list" element={<ProtectedRoute module="Billing"><PriceList /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute module="Reports"><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute module="Settings"><Settings /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute adminOnly><Roles /></ProtectedRoute>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}