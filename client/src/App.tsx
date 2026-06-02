import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import NewGrant from "./pages/NewGrant";
import EditGrant from "./pages/EditGrant";
import Admin from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import CriteriaManagement from "./pages/admin/CriteriaManagement";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  return token && user ? <>{children}</> : <Navigate to="/login" replace />;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();

  if (!token || !user) {
    return <>{children}</>;
  }

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
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
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
          {/* New route for Criteria Management - Admin only */}
          <Route
            path="/admin/criteria"
            element={
              <ProtectedRoute>
                <CriteriaManagement />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
