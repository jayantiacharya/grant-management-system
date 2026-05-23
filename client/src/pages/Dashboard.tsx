import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import "./Dashboard.css";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <div className="grant-form-card">
          <h2 className="grant-title">Welcome, {user?.email}</h2>

          <p className="grant-description">
            Submit a new grant proposal or review your existing submissions.
          </p>

          <button
            type="button"
            className="submit-btn"
            onClick={() => navigate("/grants/new")}
          >
            Submit a new grant proposal
          </button>
        </div>
      </main>
    </div>
  );
}
