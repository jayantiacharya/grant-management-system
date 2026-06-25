import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./CollegeGrants.css";

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

export default function CollegeGrants() {
  const { token } = useAuth();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [collegeName, setCollegeName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");

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

  const handleDecision = async (
    grantId: string,
    decision: "approved" | "rejected",
  ) => {
    if (!window.confirm(`Are you sure you want to ${decision} this grant?`))
      return;

    try {
      await axios.put(
        `http://localhost:5000/api/college-grants/${grantId}`,
        { collegeReviewStatus: decision },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setActionMessage(`Grant ${decision} successfully.`);
      loadGrants();
    } catch (err: any) {
      setActionMessage(err.response?.data?.message || "Failed to update grant");
    }
  };

  const getCollegeTotal = (budgetItems: BudgetItem[]) =>
    budgetItems.reduce(
      (sum, item) => sum + (parseFloat(String(item.amountFromCollege)) || 0),
      0,
    );

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const statusBadge = (status?: string) => {
    if (!status) return <span className="cg-badge-pending">Pending</span>;
    if (status === "approved")
      return <span className="cg-badge-approved">Approved</span>;
    return <span className="cg-badge-rejected">Rejected</span>;
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

          {actionMessage && <p className="form-message">{actionMessage}</p>}

          {loading ? (
            <div className="cg-loading">Loading grants...</div>
          ) : error ? (
            <div className="cg-error">{error}</div>
          ) : grants.length === 0 ? (
            <div className="cg-empty">
              No grants require college funding review at this time.
            </div>
          ) : (
            <div className="cg-list">
              {grants.map((grant) => (
                <div key={grant._id} className="cg-card">
                  <div className="cg-card-header">
                    <div>
                      <h3 className="cg-grant-title">{grant.title}</h3>
                      <p className="cg-submitted-by">
                        Submitted by: {grant.submittedEmail}
                      </p>
                      {grant.submittedAt && (
                        <p className="cg-submitted-by">
                          Date:{" "}
                          {new Date(grant.submittedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="cg-status-area">
                      {statusBadge(grant.collegeReviewStatus)}
                    </div>
                  </div>

                  <p className="cg-description">{grant.description}</p>

                  <div className="cg-funding-section">
                    <h4 className="cg-funding-title">College Funding</h4>
                    <p className="cg-funding-amount">
                      Total from College:{" "}
                      <strong>
                        {fmt(getCollegeTotal(grant.budgetItems ?? []))}
                      </strong>
                    </p>
                  </div>

                  {grant.budgetItems && grant.budgetItems.length > 0 && (
                    <div className="cg-budget-section">
                      <h4 className="cg-funding-title">Budget Items</h4>
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
                          {grant.budgetItems
                            .filter(
                              (item) =>
                                parseFloat(String(item.amountFromCollege)) > 0,
                            )
                            .map((item, idx) => (
                              <tr key={idx}>
                                <td className="cg-td">
                                  {item.itemDescription}
                                </td>
                                <td className="cg-td">{item.category}</td>
                                <td className="cg-td">
                                  {fmt(
                                    parseFloat(String(item.amountRequested)) ||
                                      0,
                                  )}
                                </td>
                                <td className="cg-td">
                                  {fmt(
                                    parseFloat(
                                      String(item.amountFromCollege),
                                    ) || 0,
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {grant.collegeReviewStatus ? (
                    <p className="cg-already-reviewed">
                      This grant has already been {grant.collegeReviewStatus}.
                    </p>
                  ) : (
                    <div className="cg-actions">
                      <button
                        className="cg-approve-btn"
                        onClick={() => handleDecision(grant._id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="cg-reject-btn"
                        onClick={() => handleDecision(grant._id, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
