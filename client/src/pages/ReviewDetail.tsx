import { useNavigate, useParams } from "react-router-dom";
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

function formatYesNo(value?: string | null) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "—";
}

export default function ReviewDetail() {
  const { grantId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [grant, setGrant] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !grantId) return;

    const fetchData = async () => {
      try {
        const [grantRes, usersRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/grants/review/${grantId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/admin/user-options", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setGrant(grantRes.data);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setMessage("Failed to load grant.");
      }
    };

    fetchData();
  }, [token, grantId, navigate]);

  const directorEmail =
    users.find((u) => u.id === grant?.projectDirectorId)?.email ??
    grant?.projectDirectorId ??
    "—";

  const handleDownload = async (savedName: string, originalName: string) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/grants/review/${grantId}/files/${encodeURIComponent(savedName)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMessage("Failed to download file.");
    }
  };

  const updateStatus = async (
    departmentReviewStatus: "approved" | "denied",
  ) => {
    if (!grantId) return;
    setLoading(true);
    setMessage("");
    try {
      await axios.put(
        `http://localhost:5000/api/grants/review/${grantId}`,
        { departmentReviewStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setGrant((prev: any) =>
        prev ? { ...prev, departmentReviewStatus } : prev,
      );
      setMessage(`Grant ${departmentReviewStatus}.`);
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
        <DashHeader back={{ label: "Back to reviews", to: "/review" }} />
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

  const files = Array.isArray(grant.files) ? grant.files : [];

  return (
    <div className="dashboard-page review-page">
      <DashHeader back={{ label: "Back to reviews", to: "/review" }} />
      <main className="review-main">
        <div className="review-welcome">
          <h2>{grant.title}</h2>
          <p>Review grant submission</p>
          <button
            type="button"
            className="review-btn review-btn-secondary"
            onClick={() => navigate("/review")}
          >
            Back to Review List
          </button>
        </div>
        {message && <p className="review-message">{message}</p>}
        <div className="review-card">
          <p>
            <strong>Status:</strong> {formatStatus(grant.reviewStatus)}
          </p>
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
            <strong>Project Director:</strong> {directorEmail}
          </p>
          <p>
            <strong>Students Impacted:</strong> {grant.studentsImpacted ?? "—"}
          </p>
          <p>
            <strong>Affects Multiple Departments:</strong>{" "}
            {formatYesNo(grant.affectsMultipleDepartments)}
          </p>
          {grant.affectsMultipleDepartments === "yes" && (
            <p>
              <strong>Department Count:</strong> {grant.departmentCount ?? "—"}
            </p>
          )}
          <p>
            <strong>Uses Human/Animal Subjects:</strong>{" "}
            {formatYesNo(grant.usesSubjects)}
          </p>
          {grant.usesSubjects === "yes" && (
            <p>
              <strong>IRB Approved:</strong> {formatYesNo(grant.irbApproved)}
            </p>
          )}
          <p>
            <strong>Description:</strong>
          </p>
          <p>{grant.description}</p>

          {files.length > 0 && (
            <>
              <p>
                <strong>Files:</strong>
              </p>
              <ul className="review-list">
                {files.map((file: any) => (
                  <li key={file.savedName} className="review-row">
                    <span className="review-row-label">
                      {file.originalName}
                    </span>
                    <div className="review-row-actions">
                      <button
                        type="button"
                        className="review-btn review-btn-secondary"
                        onClick={() =>
                          handleDownload(file.savedName, file.originalName)
                        }
                      >
                        Download
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {grant.irbApprovalFile && (
            <>
              <p>
                <strong>IRB Approval Document:</strong>
              </p>
              <ul className="review-list">
                <li className="review-row">
                  <span className="review-row-label">
                    {grant.irbApprovalFile.originalName}
                  </span>
                  <div className="review-row-actions">
                    <button
                      type="button"
                      className="review-btn review-btn-secondary"
                      onClick={() =>
                        handleDownload(
                          grant.irbApprovalFile.savedName,
                          grant.irbApprovalFile.originalName,
                        )
                      }
                    >
                      Download
                    </button>
                  </div>
                </li>
              </ul>
            </>
          )}

          <div className="review-decision-actions">
            <button
              type="button"
              className="review-btn review-btn-primary"
              disabled={loading || grant.reviewStatus === "approved"}
              onClick={() => updateStatus("approved")}
            >
              Approve
            </button>
            <button
              type="button"
              className="review-btn review-btn-primary"
              disabled={loading || grant.reviewStatus === "denied"}
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
