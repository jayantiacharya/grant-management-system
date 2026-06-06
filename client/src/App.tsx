import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NewGrant from "./pages/NewGrant";
import EditGrant from "./pages/EditGrant";
import Admin from "./pages/AdminDashboard";
import CreateCollege from "./pages/CreateCollege";
import CreateDepartment from "./pages/CreateDepartment";
import ArccCommittee from "./pages/ArccCommittee";
import Profile from "./pages/Profile";
import CriteriaManagement from "./pages/admin/CriteriaManagement";
import BudgetManagement from "./pages/grants/BudgetManagement";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  return token && user ? <>{children}</> : <Navigate to="/login" replace />;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (!token || !user) return <>{children}</>;
  return (
    <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/grants/new"
            element={
              <ProtectedRoute>
                <NewGrant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/grants/edit/:grantId"
            element={
              <ProtectedRoute>
                <EditGrant />
              </ProtectedRoute>
            }
          />
          <Route
            path="/grants/:grantId/budget"
            element={
              <ProtectedRoute>
                <BudgetManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/college"
            element={
              <ProtectedRoute>
                <CreateCollege />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/department"
            element={
              <ProtectedRoute>
                <CreateDepartment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/arcc"
            element={
              <ProtectedRoute>
                <ArccCommittee />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          {/* Admin-only: Criteria Management */}
          <Route
            path="/admin/criteria"
            element={
              <AdminRoute>
                <CriteriaManagement />
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
