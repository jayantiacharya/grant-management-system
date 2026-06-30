import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./Dashboard.css";
import "./Review.css";

type BudgetItem = {
  itemDescription: string;
  category: string;
  amountFromCollege: number;
  amountFromDepartment: number;
  amountFromARCC: number;
  amountFromOtherSources: number;
  amountRequested: number;
};

type Grant = {
  _id: string;
  title: string;
  description: string;
  submittedEmail: string;
  submittedAt: string;
  budgetItems: BudgetItem[];
  collegeReviewStatus?: string;
  status: string;
};

function formatStatus(status?: string) {
  const value = status ?? "pending";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CollegeGrantDetail() {
  const { grantId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !grantId) return;

    const fetchGrant = async () => {
      try {
        const { data } = await axios.get(
          `http://localhost:5000/api/college-grants/${grantId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setGrant(data);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          navigate("/college-grants", { replace: true });
          return;
        }
        setMessage("Failed to load grant.");
      }
    };

    fetchGrant();
  }, [token, grantId, navigate]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const getCollegeTotal = (budgetItems: BudgetItem[]) =>
    budgetItems.reduce(
      (sum, item) => sum + (parseFloat(String(item.amountFromCollege)) || 0),
      0,
    );

  const updateStatus = async (decision: "approved" | "denied") => {
    if (!grantId) return;
    if (!window.confirm(`Are you sure you want to ${decision} this grant?`))
      return;

    setLoading(true);
    setMessage("");
    try {
      await axios.put(
        `http://localhost:5000/api/college-grants/${grantId}`,
        { collegeReviewStatus: decision },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setGrant((prev) =>
        prev ? { ...prev, collegeReviewStatus: decision } : prev,
      );
      setMessage(`Grant ${decision}.`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.message ?? "Failed to update status.");
      } else {
        setMessage("Failed to update status.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!grant) {
    return (
      <div className="dashboard-page review-page">
        <DashHeader
          back={{ label: "Back to approvals", to: "/college-grants" }}
        />
        <main className="review-main">
          {message ? (
            <p className="review-message">{message}</p>
          ) : (
            <p className="review-loading">Loading...</p>
          )}
        </main>
      </div>
    );
  }

  const budgetItems = grant.budgetItems ?? [];

  return (
    <div className="dashboard-page review-page">
      <DashHeader
        back={{ label: "Back to approvals", to: "/college-grants" }}
      />
      <main className="review-main">
        <div className="review-welcome">
          <h2>{grant.title}</h2>
          <p>Review grant submission</p>
          <button
            type="button"
            className="review-btn review-btn-secondary"
            onClick={() => navigate("/college-grants")}
          >
            Back to Review List
          </button>
        </div>
        {message && <p className="review-message">{message}</p>}
        <div className="review-card">
          <p>
            <strong>Submitted by:</strong> {grant.submittedEmail}
          </p>
          <p>
            <strong>Submitted:</strong>{" "}
            {grant.submittedAt
              ? new Date(grant.submittedAt).toLocaleDateString()
              : "—"}
          </p>
          <p>
            <strong>Status:</strong> {formatStatus(grant.collegeReviewStatus)}
          </p>
          <p>
            <strong>Description:</strong>
          </p>
          <p>{grant.description}</p>

          <div className="review-criteria-section">
            <h3>College Funding</h3>
            <p>
              Total from College:{" "}
              <strong>{fmt(getCollegeTotal(budgetItems))}</strong>
            </p>

            {budgetItems.length > 0 && (
              <table className="cg-table">
                <thead>
                  <tr>
                    <th className="cg-th">Item</th>
                    <th className="cg-th">Category</th>
                    <th className="cg-th">Requested</th>
                    <th className="cg-th">From College</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetItems
                    .filter(
                      (item) => parseFloat(String(item.amountFromCollege)) > 0,
                    )
                    .map((item, idx) => (
                      <tr key={idx}>
                        <td className="cg-td">{item.itemDescription}</td>
                        <td className="cg-td">{item.category}</td>
                        <td className="cg-td">
                          {fmt(parseFloat(String(item.amountRequested)) || 0)}
                        </td>
                        <td className="cg-td">
                          {fmt(parseFloat(String(item.amountFromCollege)) || 0)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="review-decision-actions">
            <button
              type="button"
              className="review-btn review-btn-primary"
              disabled={loading || grant.collegeReviewStatus === "approved"}
              onClick={() => updateStatus("approved")}
            >
              Approve
            </button>
            <button
              type="button"
              className="review-btn review-btn-primary"
              disabled={loading || grant.collegeReviewStatus === "denied"}
              onClick={() => updateStatus("denied")}
            >
              Deny
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
