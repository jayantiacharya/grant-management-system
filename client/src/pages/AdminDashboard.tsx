import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./Dashboard.css";
import axios from "axios";

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGrants = async () => {
    if (!token) return;

    setLoading(true);

    try {
      const { data } = await axios.get("http://localhost:5000/api/grants/all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setGrants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch grants:", error);
      setGrants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }

    fetchGrants();
  }, [user, token, navigate]);

  return (
    <div className="dashboard-page">
      <DashHeader>
        <button onClick={() => navigate("/dashboard")} className="logout-btn">
          My Grants
        </button>
      </DashHeader>

      <main className="admin-main">
        <section className="admin-hero">
          <div>
            <p className="admin-eyebrow">Admin Dashboard</p>
            <h1>Welcome back</h1>
            <p>
              Manage grant applications, colleges, departments, review criteria,
              ARCC committee members, and allocation decisions.
            </p>
          </div>
        </section>

        <section className="admin-layout">
          <div className="admin-panel grant-panel">
            <div className="admin-panel-header">
              <div>
                <p className="admin-eyebrow">Grant Applications</p>
                <h2>Application Status Overview</h2>
              </div>
            </div>

            <div className="grant-status-list">
              {loading ? (
                <div className="grant-status-item">
                  Loading grant applications...
                </div>
              ) : grants.length > 0 ? (
                grants.map((grant: any) => (
                  <div
                    key={grant._id ?? grant.id}
                    className="grant-status-item"
                  >
                    <span>{grant.title ?? "Untitled Grant"}</span>
                  </div>
                ))
              ) : (
                <div className="grant-status-item">
                  No grant applications yet.
                </div>
              )}
            </div>
          </div>

          <div className="admin-actions-panel">
            <Link to="/admin/criteria" className="admin-action-card">
              <span>📋</span>
              <div>
                <h3>Review Criteria</h3>
                <p>Create and manage grant review criteria.</p>
              </div>
            </Link>

            <Link to="/admin/college" className="admin-action-card">
              <span>🏫</span>
              <div>
                <h3>College Management</h3>
                <p>Create colleges and assign deans.</p>
              </div>
            </Link>

            <Link to="/admin/department" className="admin-action-card">
              <span>🏢</span>
              <div>
                <h3>Department Management</h3>
                <p>Create departments and assign chairs.</p>
              </div>
            </Link>

            <Link to="/admin/arcc" className="admin-action-card">
              <span>👥</span>
              <div>
                <h3>ARCC Committee</h3>
                <p>Manage committee members and chair roles.</p>
              </div>
            </Link>

            <Link to="/admin/allocation" className="admin-action-card primary">
              <span>💰</span>
              <div>
                <h3>Allocation Page</h3>
                <p>Apply cutoff rules and allocate grant funding.</p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
