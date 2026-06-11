import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";

import { GRANT_STATUS } from "../types/grant";
import DashHeader from "../components/DashHeader";

import "./Dashboard.css";

export default function Dashboard() {
  const { user, token, updateUserArccStatus } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState([]);

  const fetchGrants = async () => {
    try {
      const { data } = await axios.get(
        `http://localhost:5000/api/grants/user-grants/${user?.email}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setGrants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch grants:", error);
      setGrants([]);
    }
  };

  const checkArccMembership = async () => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/admin/arcc");
      const isArcc = data.memberIds?.includes(user?.id) || false;
      updateUserArccStatus(isArcc);
    } catch (error) {
      console.error("Failed to check ARCC membership:", error);
    }
  };

  useEffect(() => {
    fetchGrants();
    if (user?.id) {
      checkArccMembership();
    }
  }, [user?.id]);

  return (
    <div className="dashboard-page">
      <DashHeader>
        {user?.isArcc && (
          <button onClick={() => navigate("/review")} className="logout-btn">
            Review
          </button>
        )}
      </DashHeader>
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
                  <div
                    key={grant._id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid #eee",
                    }}
                  >
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
