import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";

import { GRANT_STATUS, GRANT_APPROVAL_STATUS } from "../types/grant";
import DashHeader from "../components/DashHeader";

import "./Dashboard.css";

export default function Dashboard() {
  const { user, token, updateUserArccStatus } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<any[]>([]);
  const [isReviewer, setIsReviewer] = useState(false);

  useEffect(() => {
    if (user?.isDean) {
      navigate("/college-grants", { replace: true });
    }
  }, [user?.isDean, navigate]);

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

  const checkArccMembership = async () => {
    if (!token || !user?.id) return;

    try {
      const { data } = await axios.get("http://localhost:5000/api/admin/arcc", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const isArcc = data.memberIds?.includes(user.id) || false;
      updateUserArccStatus(isArcc);
    } catch (error) {
      console.error("Failed to check ARCC membership:", error);
    }
  };

  const checkDeptChair = async () => {
    if (!token) return;

    try {
      const { data } = await axios.get(
        "http://localhost:5000/api/admin/checkDeptChair/",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setIsReviewer(Boolean(data.isChair));
    } catch (error) {
      console.error("Failed to check department chair status:", error);
    }
  };

  useEffect(() => {
    fetchGrants();

    if (user?.id) {
      checkArccMembership();
      checkDeptChair();
    }
  }, [token, user?.email, user?.id]);

  const getAllocationStatus = (grant: any) =>
    String(grant.allocationStatus ?? "").toLowerCase();

  const hasPositiveAward = (grant: any) =>
    Number(grant.allocatedAmount ?? 0) > 0;

  const isRejectedGrant = (grant: any) =>
    grant.departmentReviewStatus === GRANT_APPROVAL_STATUS.DENIED ||
    grant.collegeReviewStatus === GRANT_APPROVAL_STATUS.DENIED ||
    getAllocationStatus(grant).includes("rejected");

  // A grant is truly approved only after allocation gives it money.
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

  const formatReportDueDate = (date?: string) => {
    if (!date) return "";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return "";

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsedDate);
  };

  const formatAmount = (amount: unknown) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount ?? 0));

  const renderGrantRow = (grant: any, showReportButton = false) => {
    const reportDueDate = formatReportDueDate(grant.reportDueDate);

    return (
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

          {showReportButton ? (
            <>
              <span className="grant-status">
                Awarded: {formatAmount(grant.allocatedAmount)}
              </span>

              {reportDueDate && (
                <span className="grant-status">
                  Report Due: {reportDueDate}
                </span>
              )}

              <button
                type="button"
                className="edit-btn"
                onClick={() => navigate(`/report/${grant._id}`)}
              >
                Submit Report
              </button>
            </>
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
  };

  return (
    <div className="dashboard-page">
      <DashHeader>
        {(user?.isArcc || isReviewer) && (
          <button
            type="button"
            onClick={() => navigate("/review")}
            className="logout-btn"
          >
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
              {approvedGrants.map((grant) => renderGrantRow(grant, true))}
            </div>
          )}

          {rejectedGrants.length > 0 && (
            <div>
              <h3>Rejected Grants</h3>
              {rejectedGrants.map((grant) => renderGrantRow(grant))}
            </div>
          )}

          {!user?.isDean && (
            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate("/grants/new")}
            >
              Submit a new grant proposal
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
