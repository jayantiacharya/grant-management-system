import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";

import { GRANT_STATUS } from "../types/grant";

import "./Dashboard.css";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState([]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  const handleProfile = () => {
    navigate("/profile");
  };
  const fetchGrants = async () => {
    const { data } = await axios.get(
      `http://localhost:5000/api/grants/user-grants/${user?.email}`,
    );
    setGrants(Array.isArray(data) ? data : []);
  };
  useEffect(() => {
    fetchGrants();
  }, []);

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>

        <div className="dash-user">
          <button onClick={handleProfile} className="logout-btn">
            {user?.email}
          </button>

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
          {grants.length > 0 && (
            <div>
              <h3>Your Grant Submissions:</h3>
              <div>
                {grants.map((grant: any) => (
                  <div key={grant._id}>
                    <strong>{grant.title}</strong>

                    {grant.status === GRANT_STATUS.SUBMITTED ? (
                      <span className="grant-status">Submitted</span>
                    ) : (
                      <button
                        onClick={() => navigate(`/grants/edit/${grant._id}`)}
                        className="edit-btn"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
