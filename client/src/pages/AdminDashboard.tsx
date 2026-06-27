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

  const fetchGrants = async () => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/grants/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGrants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch grants:", error);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchGrants();
  }, [token]);

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

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
              {grants.length > 0 ? (
                grants.map((grant: any) => (
                  <div key={grant._id} className="grant-status-item">
                    <span>{grant.title}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="grant-status-item">G1: Draft Grant</div>
                  <div className="grant-status-item">
                    G2: Submitted, Awaiting Review
                  </div>
                  <div className="grant-status-item">
                    G3: Submitted with Committee Reviews
                  </div>
                  <div className="grant-status-item">
                    G4: Dept and College Approved
                  </div>
                  <div className="grant-status-item">
                    G5: Department Rejected
                  </div>
                  <div className="grant-status-item">
                    G6: Pending Dean Review
                  </div>
                  <div className="grant-status-item">
                    G7: ARCC Member Own Grant
                  </div>
                  <div className="grant-status-item">
                    G8: Draft with IRB File
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="admin-actions-panel">
            <Link to="/admin/criteria" className="admin-action-card">
              <span className="admin-action-icon">📋</span>
              <div>
                <h3>Review Criteria</h3>
                <p>Create and manage grant review criteria.</p>
              </div>
            </Link>

            <Link to="/admin/college" className="admin-action-card">
              <span className="admin-action-icon">🏫</span>
              <div>
                <h3>College Management</h3>
                <p>Create colleges and assign deans.</p>
              </div>
            </Link>

            <Link to="/admin/department" className="admin-action-card">
              <span className="admin-action-icon">🏢</span>
              <div>
                <h3>Department Management</h3>
                <p>Create departments and assign chairs.</p>
              </div>
            </Link>

            <Link to="/admin/arcc" className="admin-action-card">
              <span className="admin-action-icon">👥</span>
              <div>
                <h3>ARCC Committee</h3>
                <p>Manage committee members and chair roles.</p>
              </div>
            </Link>

            <Link to="/admin/allocation" className="admin-action-card primary">
              <span className="admin-action-icon">💰</span>
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
