import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "../styles/PageLayout.css";
import "../styles/AdminManagement.css";
import "../styles/GrantForm.css";

export default function CreateCollege() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [colleges, setColleges] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [collegeName, setCollegeName] = useState("");
  const [selectedDean, setSelectedDean] = useState("");
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");

  const fetchColleges = async () => {
    const { data } = await axios.get(
      "http://localhost:5000/api/admin/colleges",
    );
    setColleges(data);
  };

  const handleDeleteCollege = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete "${name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setMessage("");
    try {
      await axios.post(
        "http://localhost:5000/api/admin/deleteCollege",
        { id },
        authHeader,
      );
      setMessage(`"${name}" deleted successfully.`);
      fetchColleges();
    } catch (error: any) {
      setMessage(error.response?.data?.message || "Failed to delete college.");
    }
  };

  const fetchUsers = async () => {
    const { data } = await axios.get(
      "http://localhost:5000/api/admin/users",
      authHeader,
    );
    setUsers(data);
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    fetchColleges();
    fetchUsers();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      if (editingId) {
        await axios.post(
          "http://localhost:5000/api/admin/updateCollege",
          { id: editingId, name: collegeName, dean: selectedDean },
          authHeader,
        );
        setMessage("College updated successfully!");
      } else {
        await axios.post(
          "http://localhost:5000/api/admin/createCollege",
          { name: collegeName, dean: selectedDean },
          authHeader,
        );
        setMessage("College created successfully!");
      }

      setCollegeName("");
      setSelectedDean("");
      setEditingId("");
      fetchColleges();
    } catch (error) {
      setMessage(
        editingId ? "Failed to update college." : "Failed to create college.",
      );
      console.log(error);
    }
  };

  return (
    <div className="dashboard-page">
      <DashHeader />

      <main className="management-main">
        <section className="management-hero">
          <div>
            <p className="admin-eyebrow">Admin Management</p>
            <h1>College Management</h1>
            <p>
              Create colleges, assign deans, and edit existing college records.
            </p>
          </div>
        </section>

        {message && <p className="form-message">{message}</p>}

        <section className="management-grid">
          <div className="management-card">
            <div className="management-card-header">
              <span className="management-icon">🏫</span>
              <div>
                <h2>Colleges</h2>
                <p>Existing colleges in the system.</p>
              </div>
            </div>

            {!colleges.length ? (
              <p className="empty-message">No colleges yet.</p>
            ) : (
              <ul className="management-list">
                {colleges.map((college: any) => (
                  <li
                    key={college.id ?? college._id ?? college.name}
                    className="management-row"
                  >
                    <span>
                      <strong>{college.name}</strong>
                      <small>{college.dean || "Dean not assigned"}</small>
                    </span>

                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => {
                        setEditingId(String(college.id ?? college._id ?? ""));
                        setCollegeName(college.name);
                        setSelectedDean(college.dean ?? "");
                        setMessage("");
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() =>
                        handleDeleteCollege(
                          String(college.id ?? college._id ?? ""),
                          college.name,
                        )
                      }
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="management-card">
            <div className="management-card-header">
              <span className="management-icon">✏️</span>
              <div>
                <h2>{editingId ? "Edit College" : "Create College"}</h2>
                <p>
                  {editingId
                    ? "Update the selected college information."
                    : "Add a new college and assign a dean."}
                </p>
              </div>
            </div>

            <form className="grant-form" onSubmit={handleSubmit}>
              <div>
                <label>College Name</label>
                <input
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  placeholder="Enter college name"
                  required
                />
              </div>

              <div>
                <label>Select Dean</label>
                <select
                  value={selectedDean}
                  onChange={(e) => setSelectedDean(e.target.value)}
                  required
                >
                  <option value="">Choose Dean</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.email}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="submit-btn">
                {editingId ? "Save Changes" : "Create College"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="save-btn"
                  onClick={() => {
                    setEditingId("");
                    setCollegeName("");
                    setSelectedDean("");
                    setMessage("");
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
