import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./ApprovedGrants.css";

type ApprovedGrant = {
  _id: string;
  title: string;
  amountAwarded: number | null;
  lastReportDate: string | null;
  reportCount: number;
};

export default function ApprovedGrants() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<ApprovedGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadGrants();
  }, [token]);

  const loadGrants = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        "http://localhost:5000/api/grant-reports/approved",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setGrants(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load grants");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <DashHeader />

      <main className="dash-main">
        <div className="ag-container">
          <h1 className="ag-title">Approved Grants</h1>
          <p className="ag-hint">
            File progress reports for your approved grants below.
          </p>

          {loading ? (
            <div className="ag-loading">Loading grants...</div>
          ) : error ? (
            <div className="ag-error">{error}</div>
          ) : grants.length === 0 ? (
            <div className="ag-empty">You have no approved grants yet.</div>
          ) : (
            <ul className="ag-list">
              {grants.map((grant) => (
                <li key={grant._id} className="ag-row">
                  <span className="ag-row-label">
                    <strong>{grant.title}</strong>
                    {" — "}
                    {grant.amountAwarded !== null
                      ? `$${grant.amountAwarded.toLocaleString()}`
                      : "Amount not yet set"}
                    {" — "}
                    {grant.lastReportDate
                      ? `Last report: ${new Date(
                          grant.lastReportDate,
                        ).toLocaleDateString()}`
                      : "No report filed yet"}
                  </span>
                  <div className="ag-row-actions">
                    <button
                      type="button"
                      className="ag-btn"
                      onClick={() => navigate(`/grant-reports/${grant._id}`)}
                    >
                      {grant.reportCount > 0
                        ? "File Another Report"
                        : "File Report"}
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
