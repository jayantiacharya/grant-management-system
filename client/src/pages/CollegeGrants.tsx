import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./CollegeGrants.css";

type Grant = {
  _id: string;
  title: string;
  submittedEmail: string;
  submittedAt: string;
  collegeReviewStatus?: string;
};

function formatStatus(status?: string) {
  const value = status ?? "pending";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CollegeGrants() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [collegeName, setCollegeName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadGrants();
  }, [token]);

  const loadGrants = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        "http://localhost:5000/api/college-grants",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setGrants(data.grants);
      setCollegeName(data.collegeName);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load grants");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "Back to dashboard", to: "/dashboard" }} />

      <main className="dash-main">
        <div className="cg-container">
          <h1 className="cg-title">College Grants Review</h1>
          {collegeName && (
            <p className="cg-subtitle">
              Reviewing grants for: <strong>{collegeName}</strong>
            </p>
          )}
          <p className="cg-hint">
            Showing grants where your college is contributing funding.
          </p>

          {loading ? (
            <div className="cg-loading">Loading grants...</div>
          ) : error ? (
            <div className="cg-error">{error}</div>
          ) : grants.length === 0 ? (
            <div className="cg-empty">
              No grants require college funding review at this time.
            </div>
          ) : (
            <ul className="review-list">
              {grants.map((grant) => (
                <li key={grant._id} className="review-row">
                  <span className="review-row-label">
                    <strong>{grant.title}</strong>
                    {" — "}
                    {grant.submittedEmail}
                    {" — "}
                    {grant.submittedAt
                      ? new Date(grant.submittedAt).toLocaleDateString()
                      : ""}
                  </span>
                  <div className="review-row-actions">
                    <span>{formatStatus(grant.collegeReviewStatus)}</span>
                    <button
                      type="button"
                      className="review-btn review-btn-secondary"
                      onClick={() => navigate(`/college-grants/${grant._id}`)}
                    >
                      View
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
