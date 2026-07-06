import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import DashHeader from "../components/DashHeader";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

type ReportInfo = {
  grantId: string;
  grantTitle: string;
  principalInvestigator: string;
  reportDueDate: string;
  awardedAmount: number;
  existingReport?: unknown;
};

export default function SubmitReport() {
  const { grantId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [reportInfo, setReportInfo] = useState<ReportInfo | null>(null);
  const [projectSummary, setProjectSummary] = useState("");
  const [currentProgress, setCurrentProgress] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [budgetInformation, setBudgetInformation] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const formatMoney = (amount: number) =>
    Number(amount || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  const formatDate = (date: string) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  useEffect(() => {
    const fetchReportInfo = async () => {
      if (!token || !grantId) return;

      try {
        const { data } = await axios.get(
          `http://localhost:5000/api/reports/${grantId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        setReportInfo(data);
      } catch (error) {
        console.error("Failed to load report info:", error);
        setMessage("Failed to load report information.");
      }
    };

    fetchReportInfo();
  }, [token, grantId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (file && file.type !== "application/pdf") {
      setMessage("Receipt file must be a PDF.");
      setReceiptFile(null);
      event.target.value = "";
      return;
    }

    setReceiptFile(file);
    setMessage("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token || !grantId) return;

    if (
      !projectSummary ||
      !currentProgress ||
      !nextSteps ||
      !budgetInformation
    ) {
      setMessage("Please complete all report text fields.");
      return;
    }

    if (!receiptFile) {
      setMessage("Please upload one PDF receipt file.");
      return;
    }

    const formData = new FormData();
    formData.append("projectSummary", projectSummary);
    formData.append("currentProgress", currentProgress);
    formData.append("nextSteps", nextSteps);
    formData.append("budgetInformation", budgetInformation);
    formData.append("receiptFile", receiptFile);

    setLoading(true);
    setMessage("");

    try {
      await axios.post(
        `http://localhost:5000/api/reports/${grantId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setMessage("Report submitted successfully.");
    } catch (error: any) {
      console.error("Failed to submit report:", error);
      setMessage(error.response?.data?.error || "Failed to submit report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "← Back to Dashboard", to: "/dashboard" }} />

      <main className="dash-main">
        <div className="grant-form-card report-form-card">
          <h2 className="grant-title">Submit Report</h2>
          <p className="grant-description">
            Submit the required project report for an approved grant.
          </p>

          {message && <p className="form-message">{message}</p>}

          {reportInfo && (
            <div className="report-summary">
              <div>
                <span>Grant Title</span>
                <strong>{reportInfo.grantTitle}</strong>
              </div>

              <div>
                <span>Principal Investigator</span>
                <strong>{reportInfo.principalInvestigator}</strong>
              </div>

              <div>
                <span>Report Due Date</span>
                <strong>{formatDate(reportInfo.reportDueDate)}</strong>
              </div>

              <div>
                <span>Awarded Amount</span>
                <strong>{formatMoney(reportInfo.awardedAmount)}</strong>
              </div>
            </div>
          )}

          <form className="grant-form" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="projectSummary">Project Summary</label>
              <textarea
                id="projectSummary"
                rows={5}
                value={projectSummary}
                onChange={(e) => setProjectSummary(e.target.value)}
                placeholder="Describe what was done and what was accomplished."
                required
              />
            </div>

            <div>
              <label htmlFor="currentProgress">Current Progress</label>
              <textarea
                id="currentProgress"
                rows={5}
                value={currentProgress}
                onChange={(e) => setCurrentProgress(e.target.value)}
                placeholder="Describe the current progress of the project."
                required
              />
            </div>

            <div>
              <label htmlFor="nextSteps">Next Steps</label>
              <textarea
                id="nextSteps"
                rows={5}
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder="Explain the remaining work or next steps."
                required
              />
            </div>

            <div>
              <label htmlFor="budgetInformation">Budget Information</label>
              <textarea
                id="budgetInformation"
                rows={5}
                value={budgetInformation}
                onChange={(e) => setBudgetInformation(e.target.value)}
                placeholder="Explain how the grant money was spent and what purchases were made."
                required
              />
            </div>

            <div>
              <label htmlFor="receiptFile">Upload Receipt PDF</label>
              <input
                id="receiptFile"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                required
              />
              <small>Upload one PDF containing all receipts.</small>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Submitting..." : "Submit Report"}
            </button>

            <button
              type="button"
              className="save-btn"
              onClick={() => navigate("/dashboard")}
            >
              Back to Dashboard
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
