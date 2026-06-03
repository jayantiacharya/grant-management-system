import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import "./ArccCommittee.css";

export default function CreateCollege() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  const fetchUsers = async () => {
    const { data } = await axios.get("http://localhost:5000/api/admin/users");
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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      if (editingId) {
        await axios.post("http://localhost:5000/api/admin/updateCollege", {
          id: editingId,
          name: collegeName,
          dean: selectedDean,
        });
        setMessage("College updated successfully!");
      } else {
        await axios.post("http://localhost:5000/api/admin/createCollege", {
          name: collegeName,
          dean: selectedDean,
        });
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
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>
        <div className="dash-user">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">
            Sign out
          </button>
        </div>
      </header>
      <main className="dash-main">
        <div className="dash-welcome">
          <h2>College Management</h2>
          <p>Create colleges or edit existing ones</p>
          <button
            type="button"
            className="edit-btn"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
          </button>
        </div>
        <div className="grant-form-card">
          <h2>Colleges</h2>
          {!colleges.length ? (
            <p>No colleges yet.</p>
          ) : (
            <ul className="list">
              {colleges.map((college: any) => (
                <li
                  key={college.id ?? college._id ?? college.name}
                  className="row"
                >
                  <span>
                    {college.name} — {college.dean || "Not assigned"}
                  </span>
                  <div className="actions">
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => {
                        setEditingId(String(college.id ?? ""));
                        setCollegeName(college.name);
                        setSelectedDean(college.dean ?? "");
                        setMessage("");
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grant-form-card">
          <h2>{editingId ? "Edit College" : "Create College"}</h2>
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
              {editingId ? "Save changes" : "Create College"}
            </button>
            {editingId && (
              <button
                type="button"
                className="edit-btn"
                onClick={() => {
                  setEditingId("");
                  setCollegeName("");
                  setSelectedDean("");
                  setMessage("");
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
          {message && <p className="form-message">{message}</p>}
        </div>
      </main>
    </div>
  );
}
