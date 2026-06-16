import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./Dashboard.css";
import "./Review.css";

function formatStatus(status?: string) {
  const value = status ?? "pending";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function Review() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState([]);
  const [message, setMessage] = useState("");
  const [deptChair, setDeptChair] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchGrants = async () => {
      try {
        const { data } = await axios.get(
          "http://localhost:5000/api/grants/review",
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setGrants(Array.isArray(data) ? data : []);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setMessage("Failed to load grants.");
      }
    };

    const checkDeptChair = async () => {
      try {
        const { data } = await axios.get(
          `http://localhost:5000/api/admin/checkDeptChair/`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setDeptChair(data.isChair);
      } catch (err) {
        console.error("Failed to check department chair status:", err);
      }
    };

    fetchGrants();
    checkDeptChair();
  }, [token, navigate, user?.email]);

  return (
    <div className="dashboard-page review-page">
      <DashHeader back={{ label: "Back to dashboard", to: "/dashboard" }} />
      <main className="review-main">
        <div className="review-welcome">
          <h2>Grant Review</h2>
          <p>Submitted grants awaiting review</p>
          <button
            type="button"
            className="review-btn review-btn-secondary"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>
          {deptChair && (
            <button
              onClick={() => navigate("/department-review")}
              className="review-btn review-btn-secondary"
            >
              Department Review
            </button>
          )}
        </div>
        {message && <p className="review-message">{message}</p>}
        <div className="review-card">
          <h2>Submitted Grants</h2>
          {!grants.length ? (
            <p>No submitted grants yet.</p>
          ) : (
            <ul className="review-list">
              {grants.map((grant: any) => (
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
                    <span>{formatStatus(grant.reviewStatus)}</span>
                    <button
                      type="button"
                      className="review-btn review-btn-secondary"
                      onClick={() => navigate(`/review/${grant._id}`)}
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
