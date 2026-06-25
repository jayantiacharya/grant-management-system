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
      <main className="dash-main">
        <div className="dash-welcome">
          <h2>Welcome back</h2>
          <p>Weber State University — Grant Management System</p>
        </div>

        {/* Navigation links */}
        <div
          className="dash-grid"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <nav className="admin-nav">
            <Link to="/admin/arcc" className="submit-btn">
              ARCC Committee
            </Link>
            <Link to="/admin/criteria" className="submit-btn">
              Manage Review Criteria
            </Link>
            <Link to="/admin/college" className="submit-btn">
              College Management
            </Link>
            <Link to="/admin/department" className="submit-btn">
              Department Management
            </Link>
          </nav>
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
      </main>
    </div>
  );
}
