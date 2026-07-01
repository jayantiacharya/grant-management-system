import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { GrantProvider } from "./context/GrantContext";

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
import Review from "./pages/Review";
import ReviewDetail from "./pages/ReviewDetail";
import BudgetWorksheet from "./pages/BudgetWorksheet";
import CriteriaManagement from "./pages/admin/CriteriaManagement";
import CollegeGrants from "./pages/CollegeGrants";
import CollegeGrantDetail from "./pages/CollegeGrantDetail";
import AllocationPage from "./pages/AllocationPage";
import DepartmentReview from "./pages/DeptReview";

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
      <GrantProvider>
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
              path="/budget-worksheet"
              element={
                <ProtectedRoute>
                  <BudgetWorksheet />
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
              path="/admin/allocation"
              element={
                <AdminRoute>
                  <AllocationPage />
                </AdminRoute>
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
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <Review />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review/:grantId"
              element={
                <ProtectedRoute>
                  <ReviewDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/criteria"
              element={
                <AdminRoute>
                  <CriteriaManagement />
                </AdminRoute>
              }
            />
            <Route
              path="/college-grants"
              element={
                <ProtectedRoute>
                  <CollegeGrants />
                </ProtectedRoute>
              }
            />
            <Route
              path="/college-grants/:grantId"
              element={
                <ProtectedRoute>
                  <CollegeGrantDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/department-review"
              element={
                <ProtectedRoute>
                  <DepartmentReview />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </GrantProvider>
    </AuthProvider>
  );
}
