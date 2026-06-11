import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import axios from "axios";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<any[]>([]);

  const fetchGrants = async () => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/grants/all");
      setGrants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch grants:", error);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>
        <div className="dash-user">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">
            Sign out
          </button>
        </div>
      </header>
      <main className="dash-main">
        <div className="dash-welcome">
          <h2>Welcome back</h2>
          <p>Weber State University — Grant Management System</p>
        </div>

        {/* Admin Quick Actions */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
          <button
            onClick={() => navigate("/admin/criteria")}
            className="submit-btn"
          >
            📋 Manage Review Criteria
          </button>
        </div>

        {/* Grant Applications */}
        {grants.length > 0 && (
          <div className="grant-form-card" style={{ marginBottom: "2rem" }}>
            <h2>Grant Applications</h2>
            {grants.map((grant: any) => (
              <div
                key={grant._id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <strong>{grant.title}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Navigation links to dedicated pages */}
        <div className="dash-grid">
          <nav className="admin-nav">
            <Link to="/admin/college" className="submit-btn">
              College Management
            </Link>
            <Link to="/admin/department" className="submit-btn">
              Department Management
            </Link>
            <Link to="/admin/arcc" className="submit-btn">
              ARCC Committee
            </Link>
          </nav>
        </div>
      </main>
    </div>
  );
}
