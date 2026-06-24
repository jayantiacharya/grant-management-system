import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { useAuth } from "../context/AuthContext";
import { GRANT_STATUS, type GrantStatus } from "../types/grant";
import { useGrant, type GrantFormData } from "../context/GrantContext";
import DashHeader from "../components/DashHeader";

import "./Dashboard.css";

export type UserOption = {
  id: string;
  email: string;
};

type GrantFormErrors = Partial<
  Record<keyof GrantFormData | "files" | "irbApprovalFile", string>
>;

const MAX_FILES = 3;

export default function NewGrant() {
  const { user, token } = useAuth();
  const { formData, setFormData, budgetItems, activeGrantId, clearGrantDraft } =
    useGrant();

  useEffect(() => {
    if (activeGrantId) {
      clearGrantDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGrantId]);

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const irbApprovalFileRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<GrantFormErrors>({});
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (user?.id && !formData.projectDirectorId) {
      setFormData((prev) => ({
        ...prev,
        projectDirectorId: user.id,
      }));
    }
  }, [user, formData.projectDirectorId, setFormData]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    axios
      .get("http://localhost:5000/api/admin/user-options", {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then((res) => setUsers(res.data))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setUsers([]);
        const fallback = "Failed to load project directors.";
        if (axios.isAxiosError(err)) {
          setMessage(err.response?.data?.message ?? fallback);
        } else {
          setMessage(fallback);
        }
      });
    return () => controller.abort();
  }, [token]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setMessage("");
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > MAX_FILES) {
      setErrors((prev) => ({
        ...prev,
        files: `Maximum ${MAX_FILES} files allowed.`,
      }));
      e.target.value = "";
      setFiles([]);
      return;
    }
    setFiles(selected);
    setErrors((prev) => ({ ...prev, files: undefined }));
    setMessage("");
  };

  // Pull matching funds total from budget items on demand
  const pullMatchingFundsFromBudget = () => {
    const total = budgetItems.reduce((sum, item) => {
      return (
        sum +
        (parseFloat(item.amountFromDepartment) || 0) +
        (parseFloat(item.amountFromCollege) || 0) +
        (parseFloat(item.amountFromOtherSources) || 0)
      );
    }, 0);
    setFormData((prev) => ({
      ...prev,
      hasMatchingFunds: total > 0,
      matchingFundsTotal: total > 0 ? String(total) : prev.matchingFundsTotal,
    }));
  };

  const validate = (
    data: GrantFormData,
    selectedFiles: File[],
  ): GrantFormErrors => {
    const next: GrantFormErrors = {};
    if (!data.title.trim()) next.title = "Title is required.";
    if (!data.description.trim()) next.description = "Description is required.";
    if (!data.projectDirectorId)
      next.projectDirectorId = "Select a project director.";
    const n = Number(data.studentsImpacted);
    if (data.studentsImpacted === "" || !Number.isInteger(n) || n < 0) {
      next.studentsImpacted =
        "Students impacted must be a non-negative integer.";
    }
    if (!data.affectsMultipleDepartments) {
      next.affectsMultipleDepartments = "Please select an option.";
    } else if (data.affectsMultipleDepartments === "yes") {
      const d = Number(data.departmentCount);
      if (data.departmentCount === "" || !Number.isInteger(d) || d < 2) {
        next.departmentCount = "Enter a number of departments (2 or more).";
      }
    }
    if (!data.usesSubjects) {
      next.usesSubjects = "Please select an option.";
    } else if (data.usesSubjects === "yes") {
      if (data.irbApproved !== "yes") {
        next.irbApproved =
          "IRB approval is required when human or animal subjects are used.";
      }
      if (selectedFiles.length === 0) {
        next.files =
          "File upload is required when human or animal subjects are used.";
      }
    }
    if (selectedFiles.length > MAX_FILES) {
      next.files = `Maximum ${MAX_FILES} files allowed.`;
    }
    if (data.irbApproved === "yes") {
      const irbFile = irbApprovalFileRef.current?.files?.[0];
      if (!irbFile) {
        next.irbApprovalFile = "IRB approval document is required.";
      }
    }
    return next;
  };

  const submitGrant = async (status: GrantStatus) => {
    const selectedFiles = Array.from(fileInputRef.current?.files ?? []);
    if (status === GRANT_STATUS.SUBMITTED) {
      const validationErrors = validate(formData, selectedFiles);
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) return;
    } else {
      setErrors({});
    }

    setLoading(true);
    setMessage("");

    try {
      const irbApprovalFile = irbApprovalFileRef.current?.files?.[0];
      const useMultipart = selectedFiles.length > 0 || !!irbApprovalFile;

      if (useMultipart) {
        const body = new FormData();
        body.append("title", formData.title);
        body.append("description", formData.description);
        body.append("projectDirectorId", formData.projectDirectorId);
        if (formData.studentsImpacted !== "") {
          body.append("studentsImpacted", formData.studentsImpacted);
        }
        body.append(
          "affectsMultipleDepartments",
          formData.affectsMultipleDepartments,
        );
        if (formData.affectsMultipleDepartments === "yes") {
          body.append("departmentCount", formData.departmentCount);
        }
        body.append("usesSubjects", formData.usesSubjects);
        if (formData.usesSubjects === "yes") {
          body.append("irbApproved", formData.irbApproved);
        }
        body.append("timeline", formData.timeline);
        body.append("hasMatchingFunds", String(formData.hasMatchingFunds));
        body.append("matchingFundsTotal", formData.matchingFundsTotal);
        body.append("budgetItems", JSON.stringify(budgetItems));
        selectedFiles.forEach((file) => body.append("files", file));
        if (irbApprovalFile) {
          body.append("irbApprovalFile", irbApprovalFile);
        }
        body.append("status", status);

        await axios.post("http://localhost:5000/api/grants/submit", body, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        const payload = {
          title: formData.title,
          description: formData.description,
          projectDirectorId: formData.projectDirectorId,
          studentsImpacted:
            formData.studentsImpacted === ""
              ? null
              : Number(formData.studentsImpacted),
          affectsMultipleDepartments: formData.affectsMultipleDepartments,
          departmentCount:
            formData.affectsMultipleDepartments === "yes"
              ? formData.departmentCount
              : "",
          usesSubjects: formData.usesSubjects,
          irbApproved:
            formData.usesSubjects === "yes" ? formData.irbApproved : "",
          timeline: formData.timeline,
          hasMatchingFunds: formData.hasMatchingFunds,
          matchingFundsTotal: formData.matchingFundsTotal,
          budgetItems,
          status,
        };

        await axios.post("http://localhost:5000/api/grants/submit", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      clearGrantDraft();
      navigate("/dashboard");
    } catch (error) {
      const fallback = "Failed to submit proposal.";
      if (axios.isAxiosError(error)) {
        setMessage(error.response?.data?.message ?? fallback);
      } else {
        setMessage(fallback);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "Back to dashboard", to: "/dashboard" }} />

      <main className="dash-main">
        <div className="grant-form-card">
          <h2 className="grant-title">Submit Grant Proposal</h2>

          <p className="grant-description">
            Submit a new grant proposal for university review and approval.
          </p>

          <form
            className="grant-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submitGrant(GRANT_STATUS.DRAFT);
            }}
          >
            <div>
              <label htmlFor="title">Grant Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter grant title"
                required
              />
              {errors.title && (
                <span className="field-error">{errors.title}</span>
              )}
            </div>

            <div>
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                rows={12}
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter a detailed grant description"
                required
              />
              {errors.description && (
                <span className="field-error">{errors.description}</span>
              )}
            </div>

            <div>
              <label htmlFor="projectDirectorId">
                Project Director / Principal Investigator
              </label>
              <select
                id="projectDirectorId"
                name="projectDirectorId"
                value={formData.projectDirectorId}
                onChange={handleChange}
                required
              >
                {user && !users.some((u) => u.id === user.id) && (
                  <option value={user.id}>{user.email}</option>
                )}
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
              {errors.projectDirectorId && (
                <span className="field-error">{errors.projectDirectorId}</span>
              )}
            </div>

            <div>
              <label htmlFor="studentsImpacted">
                Weber State University students impacted
              </label>
              <input
                type="number"
                id="studentsImpacted"
                name="studentsImpacted"
                min={0}
                step={1}
                value={formData.studentsImpacted}
                onChange={handleChange}
                placeholder="0"
                required
              />
              {errors.studentsImpacted && (
                <span className="field-error">{errors.studentsImpacted}</span>
              )}
            </div>

            <div>
              <label htmlFor="affectsMultipleDepartments">
                Does this grant affect more than one department?
              </label>
              <select
                id="affectsMultipleDepartments"
                name="affectsMultipleDepartments"
                value={formData.affectsMultipleDepartments}
                onChange={handleChange}
                required
              >
                <option value="">Select an option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {errors.affectsMultipleDepartments && (
                <span className="field-error">
                  {errors.affectsMultipleDepartments}
                </span>
              )}
            </div>

            {formData.affectsMultipleDepartments === "yes" && (
              <div>
                <label htmlFor="departmentCount">How many departments?</label>
                <input
                  type="number"
                  id="departmentCount"
                  name="departmentCount"
                  min={2}
                  step={1}
                  value={formData.departmentCount}
                  onChange={handleChange}
                  placeholder="Enter number of departments"
                  required
                />
                {errors.departmentCount && (
                  <span className="field-error">{errors.departmentCount}</span>
                )}
              </div>
            )}

            <div>
              <label htmlFor="usesSubjects">
                Does this project use human or animal subjects?
              </label>
              <select
                id="usesSubjects"
                name="usesSubjects"
                value={formData.usesSubjects}
                onChange={handleChange}
                required
              >
                <option value="">Select an option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
              {errors.usesSubjects && (
                <span className="field-error">{errors.usesSubjects}</span>
              )}
            </div>

            {formData.usesSubjects === "yes" && (
              <div>
                <label htmlFor="irbApproved">
                  Has IRB approval been completed?
                </label>
                <select
                  id="irbApproved"
                  name="irbApproved"
                  value={formData.irbApproved}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select an option</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {errors.irbApproved && (
                  <span className="field-error">{errors.irbApproved}</span>
                )}
              </div>
            )}

            {formData.irbApproved === "yes" && (
              <div>
                <label htmlFor="irbApprovalFile">
                  Upload IRB Approval Document
                </label>
                <input
                  ref={irbApprovalFileRef}
                  type="file"
                  id="irbApprovalFile"
                  name="irbApprovalFile"
                  required
                />
                {errors.irbApprovalFile && (
                  <span className="field-error">{errors.irbApprovalFile}</span>
                )}
              </div>
            )}

            <div>
              <label htmlFor="timeline">Project Timeline</label>

              <textarea
                id="timeline"
                name="timeline"
                rows={6}
                value={formData.timeline}
                onChange={handleChange}
                placeholder="e.g. August: design, September: build, or just an end date"
              />
            </div>

            <button
              type="button"
              className="submit-btn"
              onClick={() =>
                navigate("/budget-worksheet", {
                  state: { returnTo: "/grants/new" },
                })
              }
            >
              Open Budget Worksheet
            </button>

            {/* Matching Funds */}
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={formData.hasMatchingFunds}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      hasMatchingFunds: e.target.checked,
                      matchingFundsTotal: e.target.checked
                        ? prev.matchingFundsTotal
                        : "",
                    }))
                  }
                />{" "}
                This grant has matching funds
              </label>
            </div>

            {formData.hasMatchingFunds && (
              <div>
                <label htmlFor="matchingFundsTotal">
                  Matching Funds Total ($)
                </label>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <input
                    type="number"
                    id="matchingFundsTotal"
                    name="matchingFundsTotal"
                    min={0}
                    step="0.01"
                    value={formData.matchingFundsTotal}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    className="save-btn"
                    onClick={pullMatchingFundsFromBudget}
                  >
                    Pull from budget
                  </button>
                </div>
                <small>
                  Matching funds = Department + College + Other Sources
                  (excludes ARCC). Click "Pull from budget" to calculate from
                  your budget worksheet, or enter a value manually.
                </small>
              </div>
            )}

            <div>
              <label htmlFor="files">Upload Files</label>
              <input
                ref={fileInputRef}
                type="file"
                id="files"
                name="files"
                onChange={handleFileChange}
                multiple
              />
              <small>Maximum {MAX_FILES} files allowed.</small>
              {files.length > 0 && (
                <small>{files.length} file(s) selected.</small>
              )}
              {errors.files && (
                <span className="field-error">{errors.files}</span>
              )}
            </div>

            <div className="grant-form-actions">
              <button
                type="button"
                className="save-btn"
                disabled={loading}
                onClick={() => submitGrant(GRANT_STATUS.DRAFT)}
              >
                {loading ? "Saving..." : "Save Grant Proposal"}
              </button>

              <button
                type="button"
                className="submit-btn"
                disabled={loading}
                onClick={() => {
                  if (
                    window.confirm(
                      "Submitting locks this proposal and prevents further editing. Continue?",
                    )
                  ) {
                    submitGrant(GRANT_STATUS.SUBMITTED);
                  }
                }}
              >
                {loading ? "Submitting..." : "Submit Grant Proposal"}
              </button>
            </div>

            {message && <p className="form-message">{message}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
