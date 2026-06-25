import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import { type Criteria } from "../types/rubric";
import "./Dashboard.css";
import "./Review.css";

function formatYesNo(value?: string | null) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "—";
}

function isScorable(criterion: Criteria) {
  return (criterion.ratingSuggestions ?? []).length > 0;
}

type GrantReview = {
  reviewerId: string;
  scores: Record<string, number>;
  comments: string;
  submittedAt: string;
};

export default function ReviewDetail() {
  const { grantId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromApprovalView = (location.state as any)?.fromApprovalView ?? false;
  const [grant, setGrant] = useState<any>(null);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !grantId || !user?.id) return;

    const fetchData = async () => {
      try {
        const [grantRes, usersRes, criteriaRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/grants/review/${grantId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/admin/user-options", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("http://localhost:5000/api/criteria", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const grantData = grantRes.data;
        const criteriaData = Array.isArray(criteriaRes.data)
          ? criteriaRes.data
          : [];

        setGrant(grantData);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
        setCriteria(criteriaData);

        const myReview = (
          Array.isArray(grantData.reviews) ? grantData.reviews : []
        ).find(
          (review: GrantReview) =>
            String(review.reviewerId) === String(user.id),
        ) as GrantReview | undefined;

        if (myReview) {
          const initialScores: Record<string, string> = {};
          for (const [criteriaId, score] of Object.entries(
            myReview.scores ?? {},
          )) {
            initialScores[criteriaId] = String(score);
          }
          setScores(initialScores);
          setComments(myReview.comments ?? "");
        } else {
          setScores({});
          setComments("");
        }
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          navigate("/dashboard", { replace: true });
          return;
        }
        setMessage("Failed to load grant.");
      }
    };

    fetchData();
  }, [token, grantId, navigate, user?.id]);

  const directorEmail =
    users.find((u) => u.id === grant?.projectDirectorId)?.email ??
    grant?.projectDirectorId ??
    "—";

  const scorableCriteria = useMemo(
    () => criteria.filter(isScorable),
    [criteria],
  );

  const maxPossibleScore = useMemo(
    () =>
      scorableCriteria.reduce((sum, criterion) => sum + criterion.maxScore, 0),
    [scorableCriteria],
  );

  const selectedTotal = useMemo(
    () =>
      scorableCriteria.reduce((sum, criterion) => {
        const value = scores[String(criterion._id)];
        return sum + (value ? Number(value) : 0);
      }, 0),
    [scorableCriteria, scores],
  );

  const scoreToPercentage = (total: number) =>
    maxPossibleScore === 0 ? 0 : Math.round((total / maxPossibleScore) * 100);

  const selectedPercentage = scoreToPercentage(selectedTotal);

  const allCriteriaScored = useMemo(
    () =>
      scorableCriteria.length > 0 &&
      scorableCriteria.every((criterion) => {
        const value = scores[String(criterion._id)];
        return value !== undefined && value !== "";
      }),
    [scorableCriteria, scores],
  );

  const submittedReviews: GrantReview[] = Array.isArray(grant?.reviews)
    ? grant.reviews
    : [];

  const getReviewerLabel = (reviewerId: string) =>
    users.find((u) => String(u.id) === String(reviewerId))?.email ?? reviewerId;

  const getCriterionName = (criteriaId: string) =>
    criteria.find((criterion) => String(criterion._id) === String(criteriaId))
      ?.name ?? criteriaId;

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
        `http://localhost:5000/api/grants/review/approval/${grantId}`,
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
  const handleScoreChange = (criteriaId: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [criteriaId]: value,
    }));
  };

  const submitReview = async () => {
    if (!grantId || !allCriteriaScored) return;

    const payloadScores = scorableCriteria.reduce<Record<string, number>>(
      (acc, criterion) => {
        const criteriaId = String(criterion._id);
        const value = scores[criteriaId];
        if (value) {
          acc[criteriaId] = Number(value);
        }
        return acc;
      },
      {},
    );

    setLoading(true);
    setMessage("");
    try {
      const { data } = await axios.put(
        `http://localhost:5000/api/grants/review/${grantId}`,
        { scores: payloadScores, comments },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setGrant((prev: any) => {
        if (!prev) return prev;
        const existingReviews = Array.isArray(prev.reviews) ? prev.reviews : [];
        const existingIndex = existingReviews.findIndex(
          (review: GrantReview) =>
            String(review.reviewerId) === String(user?.id),
        );
        const updatedReviews =
          existingIndex >= 0
            ? existingReviews.map((review: GrantReview, index: number) =>
                index === existingIndex ? data : review,
              )
            : [...existingReviews, data];
        return { ...prev, reviews: updatedReviews };
      });
      setMessage("Review submitted.");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setMessage(err.response?.data?.message ?? "Failed to submit review.");
      } else {
        setMessage("Failed to submit review.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!grant) {
    return (
      <div className="dashboard-page review-page">
        {fromApprovalView ? (
          <DashHeader
            back={{ label: "Back to approvals", to: "/department-review" }}
          />
        ) : (
          <DashHeader back={{ label: "Back to reviews", to: "/review" }} />
        )}
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
      {fromApprovalView ? (
        <DashHeader
          back={{ label: "Back to approvals", to: "/department-review" }}
        />
      ) : (
        <DashHeader back={{ label: "Back to reviews", to: "/review" }} />
      )}
      <main className="review-main">
        <div className="review-welcome">
          <h2>{grant.title}</h2>
          <p>Review grant submission</p>
          {fromApprovalView ? (
            <button
              type="button"
              className="review-btn review-btn-secondary"
              onClick={() => navigate("/department-review")}
            >
              Back to Review List
            </button>
          ) : (
            <button
              type="button"
              className="review-btn review-btn-secondary"
              onClick={() => navigate("/review")}
            >
              Back to Review List
            </button>
          )}
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

          {fromApprovalView ? (
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
          ) : (
            <>
              {" "}
              <div className="review-criteria-section">
                <h3>Grading Criteria</h3>
                {criteria.length === 0 ? (
                  <p>No review criteria configured yet.</p>
                ) : (
                  <>
                    {criteria.map((criterion) => {
                      const criteriaId = String(criterion._id);
                      return (
                        <div key={criteriaId} className="review-criterion">
                          <p>
                            <strong>{criterion.name}</strong> (max{" "}
                            {criterion.maxScore})
                          </p>
                          <p>{criterion.description}</p>
                          {isScorable(criterion) ? (
                            <select
                              className="review-criterion-select"
                              value={scores[criteriaId] ?? ""}
                              onChange={(e) =>
                                handleScoreChange(criteriaId, e.target.value)
                              }
                            >
                              <option value="">Select a score...</option>
                              {(criterion.ratingSuggestions ?? []).map(
                                (suggestion, idx) => (
                                  <option
                                    key={`${criteriaId}-${suggestion.score}-${idx}`}
                                    value={String(suggestion.score)}
                                  >
                                    {suggestion.score} —{" "}
                                    {suggestion.description}
                                  </option>
                                ),
                              )}
                            </select>
                          ) : (
                            <p className="review-criterion-note">
                              No score options configured — not included in your
                              total.
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <p className="review-score-total">
                      <strong>Your total:</strong> {selectedPercentage}%
                    </p>
                    <label
                      className="review-comments-label"
                      htmlFor="review-comments"
                    >
                      Comments
                    </label>
                    <textarea
                      id="review-comments"
                      className="review-comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={4}
                      placeholder="Add review comments..."
                    />
                    <div className="review-submit-actions">
                      <button
                        type="button"
                        className="review-btn review-btn-primary"
                        disabled={loading || !allCriteriaScored}
                        onClick={submitReview}
                      >
                        Submit Review
                      </button>
                    </div>
                  </>
                )}
              </div>
              {submittedReviews.length > 0 && (
                <div className="review-submitted-list">
                  <h3>Submitted Reviews</h3>
                  {submittedReviews.map((review) => {
                    const reviewTotal = scorableCriteria.reduce(
                      (sum, criterion) => {
                        const score = review.scores?.[String(criterion._id)];
                        return sum + (typeof score === "number" ? score : 0);
                      },
                      0,
                    );
                    return (
                      <div
                        key={`${review.reviewerId}-${review.submittedAt}`}
                        className="review-submitted-item"
                      >
                        <p>
                          <strong>{getReviewerLabel(review.reviewerId)}</strong>
                          {" — "}
                          {review.submittedAt
                            ? new Date(review.submittedAt).toLocaleString()
                            : "—"}
                        </p>
                        <p>
                          <strong>Total score:</strong>{" "}
                          {scoreToPercentage(reviewTotal)}%
                        </p>
                        <ul>
                          {Object.entries(review.scores ?? {}).map(
                            ([criteriaId, score]) => (
                              <li key={criteriaId}>
                                {getCriterionName(criteriaId)}: {score}
                              </li>
                            ),
                          )}
                        </ul>
                        {review.comments && (
                          <p>
                            <strong>Comments:</strong> {review.comments}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
