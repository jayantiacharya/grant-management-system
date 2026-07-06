import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./Dashboard.css";

type GrantReportErrors = Partial<{
  reportText: string;
  currentProgress: string;
  nextSteps: string;
}>;

export default function GrantReport() {
  const { grantId } = useParams<{ grantId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [amountAwarded, setAmountAwarded] = useState<number | null>(null);

  const [reportText, setReportText] = useState("");
  const [currentProgress, setCurrentProgress] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const [errors, setErrors] = useState<GrantReportErrors>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!grantId || !token) return;
    axios
      .get(`http://localhost:5000/api/grant-reports/${grantId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setTitle(res.data.title);
        setAmountAwarded(res.data.amountAwarded);
      })
      .catch((err) => {
        const fallback = "Failed to load grant.";
        if (axios.isAxiosError(err)) {
          setMessage(err.response?.data?.message ?? fallback);
        } else {
          setMessage(fallback);
        }
      })
      .finally(() => setLoading(false));
  }, [grantId, token]);

  const validate = (): GrantReportErrors => {
    const next: GrantReportErrors = {};
    if (!reportText.trim()) next.reportText = "Report is required.";
    if (!currentProgress.trim())
      next.currentProgress = "Current progress is required.";
    if (!nextSteps.trim()) next.nextSteps = "Next steps are required.";
    return next;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setMessage("");

    try {
      const body = new FormData();
      body.append("reportText", reportText);
      body.append("currentProgress", currentProgress);
      body.append("nextSteps", nextSteps);
      const file = fileInputRef.current?.files?.[0];
      if (file) body.append("file", file);

      await axios.post(
        `http://localhost:5000/api/grant-reports/${grantId}/submit`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      navigate("/approved-grants");
    } catch (err) {
      const fallback = "Failed to submit report.";
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.message ?? fallback);
      } else {
        setMessage(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <DashHeader back={{ label: "Back", to: "/approved-grants" }} />
        <main className="dash-main">Loading...</main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <DashHeader
        back={{ label: "Back to approved grants", to: "/approved-grants" }}
      />

      <main className="dash-main">
        <div className="grant-form-card">
          <h2 className="grant-title">Submit Grant Report</h2>
          <p className="grant-description">
            File a progress report for this approved grant.
          </p>

          <form
            className="grant-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div>
              <label>Grant Title</label>
              <input type="text" value={title} disabled readOnly />
            </div>

            <div>
              <label>Amount Awarded</label>
              <input
                type="text"
                value={
                  amountAwarded !== null
                    ? `$${amountAwarded.toLocaleString()}`
                    : "Not yet set"
                }
                disabled
                readOnly
              />
            </div>

            <div>
              <label htmlFor="reportText">Report</label>
              <textarea
                id="reportText"
                rows={8}
                value={reportText}
                onChange={(e) => {
                  setReportText(e.target.value);
                  setErrors((prev) => ({ ...prev, reportText: undefined }));
                }}
                placeholder="Describe the work completed for this reporting period"
              />
              {errors.reportText && (
                <span className="field-error">{errors.reportText}</span>
              )}
            </div>

            <div>
              <label htmlFor="currentProgress">Current Progress</label>
              <textarea
                id="currentProgress"
                rows={6}
                value={currentProgress}
                onChange={(e) => {
                  setCurrentProgress(e.target.value);
                  setErrors((prev) => ({
                    ...prev,
                    currentProgress: undefined,
                  }));
                }}
                placeholder="Summarize where the project currently stands"
              />
              {errors.currentProgress && (
                <span className="field-error">{errors.currentProgress}</span>
              )}
            </div>

            <div>
              <label htmlFor="nextSteps">Next Steps</label>
              <textarea
                id="nextSteps"
                rows={6}
                value={nextSteps}
                onChange={(e) => {
                  setNextSteps(e.target.value);
                  setErrors((prev) => ({ ...prev, nextSteps: undefined }));
                }}
                placeholder="Describe what's planned next"
              />
              {errors.nextSteps && (
                <span className="field-error">{errors.nextSteps}</span>
              )}
            </div>

            <div>
              <label htmlFor="file">Upload Supporting File</label>
              <input ref={fileInputRef} type="file" id="file" name="file" />
            </div>

            <div className="grant-form-actions">
              <button
                type="submit"
                className="submit-btn"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>

            {message && <p className="form-message">{message}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
