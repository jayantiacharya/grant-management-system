import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./Dashboard.css";

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
    if (!status) return <span style={styles.badgePending}>Pending</span>;
    if (status === "approved")
      return <span style={styles.badgeApproved}>Approved</span>;
    return <span style={styles.badgeRejected}>Rejected</span>;
  };

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "Back to dashboard", to: "/dashboard" }} />

      <main className="dash-main">
        <div style={styles.container}>
          <h1 style={styles.title}>College Grants Review</h1>
          {collegeName && (
            <p style={styles.subtitle}>
              Reviewing grants for: <strong>{collegeName}</strong>
            </p>
          )}
          <p style={styles.hint}>
            Showing grants where your college is contributing funding.
          </p>

          {actionMessage && <p className="form-message">{actionMessage}</p>}

          {loading ? (
            <div style={styles.loading}>Loading grants...</div>
          ) : error ? (
            <div style={styles.error}>{error}</div>
          ) : grants.length === 0 ? (
            <div style={styles.empty}>
              No grants require college funding review at this time.
            </div>
          ) : (
            <div style={styles.list}>
              {grants.map((grant) => (
                <div key={grant._id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h3 style={styles.grantTitle}>{grant.title}</h3>
                      <p style={styles.submittedBy}>
                        Submitted by: {grant.submittedEmail}
                      </p>
                      {grant.submittedAt && (
                        <p style={styles.submittedBy}>
                          Date:{" "}
                          {new Date(grant.submittedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div style={styles.statusArea}>
                      {statusBadge(grant.collegeReviewStatus)}
                    </div>
                  </div>

                  <p style={styles.description}>{grant.description}</p>

                  <div style={styles.fundingSection}>
                    <h4 style={styles.fundingTitle}>College Funding</h4>
                    <p style={styles.fundingAmount}>
                      Total from College:{" "}
                      <strong>
                        {fmt(getCollegeTotal(grant.budgetItems ?? []))}
                      </strong>
                    </p>
                  </div>

                  {grant.budgetItems && grant.budgetItems.length > 0 && (
                    <div style={styles.budgetSection}>
                      <h4 style={styles.fundingTitle}>Budget Items</h4>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Item</th>
                            <th style={styles.th}>Category</th>
                            <th style={styles.th}>Requested</th>
                            <th style={styles.th}>From College</th>
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
                                <td style={styles.td}>
                                  {item.itemDescription}
                                </td>
                                <td style={styles.td}>{item.category}</td>
                                <td style={styles.td}>
                                  {fmt(
                                    parseFloat(String(item.amountRequested)) ||
                                      0,
                                  )}
                                </td>
                                <td style={styles.td}>
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
                    <p style={styles.alreadyReviewed}>
                      This grant has already been {grant.collegeReviewStatus}.
                    </p>
                  ) : (
                    <div style={styles.actions}>
                      <button
                        style={styles.approveBtn}
                        onClick={() => handleDecision(grant._id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        style={styles.rejectBtn}
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

const styles = {
  container: { maxWidth: "900px", margin: "0 auto", padding: "2rem" },
  title: { margin: "0 0 0.5rem 0", color: "#2c3e50" },
  subtitle: { margin: "0 0 0.25rem 0", color: "#555" },
  hint: { margin: "0 0 1.5rem 0", color: "#888", fontSize: "0.9rem" },
  loading: { textAlign: "center" as const, padding: "3rem", color: "#666" },
  error: {
    padding: "1rem",
    background: "#fee",
    color: "#c0392b",
    borderRadius: "6px",
  },
  empty: {
    textAlign: "center" as const,
    padding: "3rem",
    color: "#888",
    background: "#fafafa",
    borderRadius: "8px",
    border: "1px dashed #ddd",
  },
  list: { display: "flex", flexDirection: "column" as const, gap: "1.5rem" },
  card: {
    background: "white",
    borderRadius: "8px",
    padding: "1.5rem",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    border: "1px solid #e0e0e0",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: "1rem",
  },
  grantTitle: { margin: "0 0 0.25rem 0", color: "#2c3e50" },
  submittedBy: { margin: "0.1rem 0", color: "#666", fontSize: "0.875rem" },
  statusArea: { flexShrink: 0 },
  badgePending: {
    background: "#fef3cd",
    color: "#856404",
    padding: "0.25rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  badgeApproved: {
    background: "#d4edda",
    color: "#155724",
    padding: "0.25rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  badgeRejected: {
    background: "#f8d7da",
    color: "#721c24",
    padding: "0.25rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  description: { color: "#555", marginBottom: "1rem", lineHeight: 1.5 },
  fundingSection: {
    background: "#f0f7ff",
    borderRadius: "6px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
  },
  fundingTitle: { margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#444" },
  fundingAmount: { margin: 0, color: "#2980b9" },
  budgetSection: { marginBottom: "1rem", overflowX: "auto" as const },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.875rem",
  },
  th: {
    background: "#f0f0f0",
    padding: "0.5rem 0.75rem",
    textAlign: "left" as const,
    borderBottom: "2px solid #ddd",
  },
  td: { padding: "0.5rem 0.75rem", borderBottom: "1px solid #eee" },
  alreadyReviewed: {
    color: "#666",
    fontStyle: "italic",
    margin: "0.5rem 0 0 0",
  },
  actions: { display: "flex", gap: "1rem", marginTop: "1rem" },
  approveBtn: {
    background: "#d4edda",
    color: "#155724",
    border: "1px solid #c3e6cb",
    padding: "0.6rem 1.5rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
  },
  rejectBtn: {
    background: "#f8d7da",
    color: "#721c24",
    border: "1px solid #f5c6cb",
    padding: "0.6rem 1.5rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
  },
};
