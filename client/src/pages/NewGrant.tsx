import { useNavigate } from "react-router-dom";
import { useEffect, useState, type ChangeEvent } from "react";
import axios from "axios";

import { useAuth } from "../context/AuthContext";

import "./Dashboard.css";

export type UserOption = {
  id: string;
  email: string;
};

export type GrantSubmission = {
  title: string;
  description: string;
  projectDirectorId: string;
  studentsImpacted: number;
};

type GrantFormState = Omit<GrantSubmission, "studentsImpacted"> & {
  studentsImpacted: string;
};

type GrantFormErrors = Partial<Record<keyof GrantFormState, string>>;

export default function NewGrant() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<GrantFormState>({
    title: "",
    description: "",
    projectDirectorId: user?.id ?? "",
    studentsImpacted: "",
  });
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

  const validate = (data: GrantFormState): GrantFormErrors => {
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
    return next;
  };

  const submitGrant = async () => {
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    setMessage("");

    const payload: GrantSubmission = {
      title: formData.title,
      description: formData.description,
      projectDirectorId: formData.projectDirectorId,
      studentsImpacted: Number(formData.studentsImpacted),
    };

    try {
      await axios.post("http://localhost:5000/api/grants/submit", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage("Grant proposal submitted successfully.");

      setFormData({
        title: "",
        description: "",
        projectDirectorId: user?.id ?? "",
        studentsImpacted: "",
      });
      setErrors({});
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
              submitGrant();
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

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Submitting..." : "Submit Proposal"}
            </button>

            {message && <p className="form-message">{message}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
