import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";

import { GRANT_STATUS, GRANT_APPROVAL_STATUS } from "../types/grant";
import DashHeader from "../components/DashHeader";
import { isDeanOnly } from "../utils/roles";

import "../styles/PageLayout.css";
import "../styles/Dashboard.css";
import "../styles/GrantForm.css";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type ReportReminder = {
  grant: any;
  daysUntilDue: number;
  overdue: boolean;
};

// Builds the list of approved grants whose report is due soon, overdue, or
// otherwise still within the reminder window (90 days out, up to 365 days
// past due). Grants that already have a filed report are excluded entirely.
const getReportReminders = (grantList: any[]): ReportReminder[] => {
  const now = Date.now();

  return grantList
    .filter((grant) => {
      const hasDueDate = Boolean(grant.reportDueDate);
      const alreadyReported =
        Array.isArray(grant.reports) && grant.reports.length > 0;
      return hasDueDate && !alreadyReported;
    })
    .map((grant) => {
      const dueTime = new Date(grant.reportDueDate).getTime();
      const daysUntilDue = Math.ceil((dueTime - now) / MS_PER_DAY);
      return {
        grant,
        daysUntilDue,
        overdue: daysUntilDue < 0,
      };
    })
    .filter(
      (reminder) =>
        reminder.daysUntilDue <= 90 && reminder.daysUntilDue >= -365,
    )
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
};

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

  const reportReminders = getReportReminders(approvedGrants);

  const formatAmount = (amount: unknown) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Number(amount ?? 0));

  const renderGrantRow = (grant: any) => (
    <div key={grant._id} className="dash-grant-row">
      <strong>{grant.title}</strong>

      <div className="dash-grant-row-actions">
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
          {reportReminders.length > 0 && (
            <div className="report-reminder-banner">
              {reportReminders.map(({ grant, daysUntilDue, overdue }) => (
                <p key={grant._id} className="report-reminder-item">
                  {overdue
                    ? `Report for "${grant.title}" is overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"}.`
                    : daysUntilDue === 0
                      ? `Report for "${grant.title}" is due today.`
                      : `Report for "${grant.title}" is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`}{" "}
                  <button
                    type="button"
                    className="report-reminder-link"
                    onClick={() => navigate("/approved-grants")}
                  >
                    File report
                  </button>
                </p>
              ))}
            </div>
          )}

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
            <div className="dash-actions">
              <button
                type="button"
                className="submit-btn"
                onClick={() => navigate("/approved-grants")}
              >
                View Approved Grants / File Report
              </button>
              <button
                type="button"
                className="submit-btn"
                onClick={() => navigate("/grants/new")}
              >
                Submit a new grant proposal
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
