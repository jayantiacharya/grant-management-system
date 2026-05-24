import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

import { useAuth } from "../context/AuthContext";

import "./Dashboard.css";

interface UserOption {
  id: string;
  email: string;
}

export default function NewGrant() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    projectDirectorId: user?.id ?? "",
    studentsImpacted: "",
  });
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    axios
      .get("http://localhost:5000/api/admin/user-options", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]));
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      await axios.post(
        "http://localhost:5000/api/grants/submit",
        {
          title: formData.title,
          description: formData.description,
          projectDirectorId: formData.projectDirectorId,
          studentsImpacted: Number(formData.studentsImpacted),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setMessage("Grant proposal submitted successfully.");

      setFormData({
        title: "",
        description: "",
        projectDirectorId: user?.id ?? "",
        studentsImpacted: "",
      });
    } catch (error: any) {
      setMessage(error.response?.data?.message || "Failed to submit proposal.");
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

          <form className="grant-form" onSubmit={handleSubmit}>
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
                <option value="" disabled>
                  Select project director
                </option>
                {users.length === 0 && user && (
                  <option value={user.id}>{user.email}</option>
                )}
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
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
