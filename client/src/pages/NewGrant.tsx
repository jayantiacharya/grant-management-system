import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import axios from "axios";

import { useAuth } from "../context/AuthContext";

import "./Dashboard.css";

export type UserOption = {
  id: string;
  email: string;
};

type YesNo = "" | "yes" | "no";

export type GrantSubmission = {
  title: string;
  description: string;
  projectDirectorId: string;
  studentsImpacted: number;
  affectsMultipleDepartments: YesNo;
  departmentCount: string;
  usesSubjects: YesNo;
  irbApproved: YesNo;
};

type GrantFormState = Omit<GrantSubmission, "studentsImpacted"> & {
  studentsImpacted: string;
};

type GrantFormErrors = Partial<
  Record<keyof GrantFormState | "files" | "irbApprovalFile", string>
>;

const MAX_FILES = 3;

export default function NewGrant() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const irbApprovalFileRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<GrantFormState>({
    title: "",
    description: "",
    projectDirectorId: user?.id ?? "",
    studentsImpacted: "",
    affectsMultipleDepartments: "",
    departmentCount: "",
    usesSubjects: "",
    irbApproved: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<GrantFormErrors>({});
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
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

  const validate = (
    data: GrantFormState,
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

  const submitGrant = async (status: "draft" | "submitted") => {
    const selectedFiles = Array.from(fileInputRef.current?.files ?? []);
    if (status === "submitted") {
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

      let response;
      if (useMultipart) {
        const body = new FormData();
        const irbApprovalFile = irbApprovalFileRef.current?.files?.[0];
        body.append("title", formData.title);
        body.append("description", formData.description);
        body.append("projectDirectorId", formData.projectDirectorId);
        body.append(
          "studentsImpacted",
          String(Number(formData.studentsImpacted)),
        );
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
        selectedFiles.forEach((file) => body.append("files", file));
        if (irbApprovalFile) {
          body.append("irbApprovalFile", irbApprovalFile);
        }
        body.append("status", status);

        response = await axios.post(
          "http://localhost:5000/api/grants/submit",
          body,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          },
        );
      } else {
        const payload = {
          title: formData.title,
          description: formData.description,
          projectDirectorId: formData.projectDirectorId,
          studentsImpacted: Number(formData.studentsImpacted),
          affectsMultipleDepartments: formData.affectsMultipleDepartments,
          departmentCount:
            formData.affectsMultipleDepartments === "yes"
              ? formData.departmentCount
              : "",
          usesSubjects: formData.usesSubjects,
          irbApproved:
            formData.usesSubjects === "yes" ? formData.irbApproved : "",
          status,
        };

        response = await axios.post(
          "http://localhost:5000/api/grants/submit",
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      }

      void response;
      setMessage(
        status === "submitted"
          ? "Grant proposal submitted successfully."
          : "Draft saved.",
      );

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
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>

        <div className="dash-user">
          <span>{user?.email}</span>

          <button onClick={() => navigate("/dashboard")} className="logout-btn">
            Back to dashboard
          </button>

          <button onClick={handleLogout} className="logout-btn">
            Sign out
          </button>
        </div>
      </header>

      <main className="dash-main">
        <div className="grant-form-card">
          <h2 className="grant-title">Submit Grant Proposal</h2>

          <p className="grant-description">
            Submit a new grant proposal for university review and approval.
          </p>

          <form
            className="grant-form"
            onSubmit={(e) => {
              e.preventDefault();
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
                onClick={() => submitGrant("draft")}
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
                    submitGrant("submitted");
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
