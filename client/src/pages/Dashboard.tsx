import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";

import { GRANT_STATUS, GRANT_APPROVAL_STATUS } from "../types/grant";
import DashHeader from "../components/DashHeader";
import { isDeanOnly } from "../utils/roles";

import "./Dashboard.css";

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<any[]>([]);

  useEffect(() => {
    // Wait for AuthContext to resolve isArcc/isDeptChair before redirecting.
    // During that window the flags are undefined, and isDeanOnly would read a
    // dean who is also ARCC/chair as dean-only and bounce them off their
    // dashboard.
    if (user?.isArcc === undefined || user?.isDeptChair === undefined) return;
    if (isDeanOnly(user)) {
      navigate("/college-grants", { replace: true });
    }
  }, [user, navigate]);

  const fetchGrants = async () => {
    if (!user?.email || !token) {
      setGrants([]);
      return;
    }

    try {
      const { data } = await axios.get(
        `http://localhost:5000/api/grants/user-grants/${user.email}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setGrants(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch grants:", error);
      setGrants([]);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, [token, user?.email]);

  const getAllocationStatus = (grant: any) =>
    String(grant.allocationStatus ?? "").toLowerCase();

  const hasPositiveAward = (grant: any) =>
    Number(grant.allocatedAmount ?? 0) > 0;

  const isRejectedGrant = (grant: any) =>
    grant.departmentReviewStatus === GRANT_APPROVAL_STATUS.DENIED ||
    grant.collegeReviewStatus === GRANT_APPROVAL_STATUS.DENIED ||
    getAllocationStatus(grant).includes("rejected");

  // A grant is approved only after allocation gives it a positive award.
  const isApprovedGrant = (grant: any) =>
    !isRejectedGrant(grant) && hasPositiveAward(grant);

  const savedGrants = grants.filter(
    (grant) =>
      grant.status !== GRANT_STATUS.SUBMITTED &&
      !isApprovedGrant(grant) &&
      !isRejectedGrant(grant),
  );

  const submittedGrants = grants.filter(
    (grant) =>
      grant.status === GRANT_STATUS.SUBMITTED &&
      !isApprovedGrant(grant) &&
      !isRejectedGrant(grant),
  );

  const approvedGrants = grants.filter(isApprovedGrant);
  const rejectedGrants = grants.filter(isRejectedGrant);

  const formatAmount = (amount: unknown) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount ?? 0));

  const renderGrantRow = (grant: any) => (
    <div
      key={grant._id}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <strong>{grant.title}</strong>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {grant.departmentReviewStatus === GRANT_APPROVAL_STATUS.APPROVED ? (
          <span className="grant-status">Department Approved</span>
        ) : grant.departmentReviewStatus === GRANT_APPROVAL_STATUS.DENIED ? (
          <span className="grant-status">Department Denied</span>
        ) : (
          <span className="grant-status">Department Pending</span>
        )}

        {grant.collegeReviewStatus !== "N/A" &&
          (grant.collegeReviewStatus === GRANT_APPROVAL_STATUS.APPROVED ? (
            <span className="grant-status">College Approved</span>
          ) : grant.collegeReviewStatus === GRANT_APPROVAL_STATUS.DENIED ? (
            <span className="grant-status">College Denied</span>
          ) : (
            <span className="grant-status">College Pending</span>
          ))}

        {isApprovedGrant(grant) ? (
          <span className="grant-status">
            Awarded: {formatAmount(grant.allocatedAmount)}
          </span>
        ) : grant.status === GRANT_STATUS.SUBMITTED ? (
          <span className="grant-status">Submitted</span>
        ) : (
          <button
            type="button"
            className="edit-btn"
            onClick={() => navigate(`/grants/edit/${grant._id}`)}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      <DashHeader />

      <main className="dash-main">
        <div className="grant-form-card">
          <h2 className="grant-title">Welcome, {user?.email}</h2>

          <p className="grant-description">
            Submit a new grant proposal or review your existing submissions.
          </p>

          {grants.length === 0 && (
            <p className="grant-status">No grant submissions yet.</p>
          )}

          {savedGrants.length > 0 && (
            <div>
              <h3>Saved Grants</h3>
              {savedGrants.map((grant) => renderGrantRow(grant))}
            </div>
          )}

          {submittedGrants.length > 0 && (
            <div>
              <h3>Submitted Grants</h3>
              {submittedGrants.map((grant) => renderGrantRow(grant))}
            </div>
          )}

          {approvedGrants.length > 0 && (
            <div>
              <h3>Approved Grants</h3>
              {approvedGrants.map((grant) => renderGrantRow(grant))}
            </div>
          )}

          {rejectedGrants.length > 0 && (
            <div>
              <h3>Rejected Grants</h3>
              {rejectedGrants.map((grant) => renderGrantRow(grant))}
            </div>
          )}

          {!isDeanOnly(user) && (
            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate("/grants/new")}
            >
              Submit a new grant proposal
            </button>
          )}
          {!isDeanOnly(user) && (
            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate("/approved-grants")}
            >
              View Approved Grants / File Report
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
