import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import "./ArccCommittee.css";

export default function CreateDepartment() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departmentName, setDepartmentName] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedChair, setSelectedChair] = useState("");
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");

  const fetchColleges = async () => {
    const { data } = await axios.get(
      "http://localhost:5000/api/admin/colleges",
    );
    setColleges(data);
  };

  const fetchDepartments = async () => {
    const { data } = await axios.get(
      "http://localhost:5000/api/admin/departments",
    );
    setDepartments(data);
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
    fetchDepartments();
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
        await axios.post("http://localhost:5000/api/admin/updateDepartment", {
          id: editingId,
          name: departmentName,
          college: selectedCollege,
          chair: selectedChair,
        });
        setMessage("Department updated successfully.");
      } else {
        await axios.post("http://localhost:5000/api/admin/createDepartment", {
          name: departmentName,
          college: selectedCollege,
          chair: selectedChair,
        });
        setMessage("Department created successfully.");
      }

      setDepartmentName("");
      setSelectedCollege("");
      setSelectedChair("");
      setEditingId("");
      fetchDepartments();
    } catch (error) {
      setMessage(
        editingId
          ? "Failed to update department."
          : "Failed to create department.",
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
          <h2>Department Management</h2>
          <p>Create departments or edit existing ones</p>
          <button
            type="button"
            className="edit-btn"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
          </button>
        </div>
        <div className="grant-form-card">
          <h2>Departments</h2>
          {!departments.length ? (
            <p>No departments yet.</p>
          ) : (
            <ul className="list">
              {departments.map((department: any) => (
                <li
                  key={department.id ?? department._id ?? department.name}
                  className="row"
                >
                  <span>
                    {department.name} — {department.college} —{" "}
                    {department.chair || "Not assigned"}
                  </span>
                  <div className="actions">
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => {
                        setEditingId(
                          String(department.id ?? department._id ?? ""),
                        );
                        setDepartmentName(department.name);
                        setSelectedCollege(department.college ?? "");
                        setSelectedChair(department.chair ?? "");
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
          <h2>{editingId ? "Edit Department" : "Create Department"}</h2>
          <form className="grant-form" onSubmit={handleSubmit}>
            <div>
              <label>Department Name</label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="Enter department name"
                required
              />
            </div>

            <div>
              <label>Select College</label>
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                required
              >
                <option value="">Choose College</option>
                {colleges.map((college: any) => (
                  <option key={college.id ?? college.name} value={college.name}>
                    {college.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Department Chair</label>
              <select
                value={selectedChair}
                onChange={(e) => setSelectedChair(e.target.value)}
                required
              >
                <option value="">Choose Chair</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.email}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="submit-btn">
              {editingId ? "Save changes" : "Create Department"}
            </button>
            {editingId && (
              <button
                type="button"
                className="edit-btn"
                onClick={() => {
                  setEditingId("");
                  setDepartmentName("");
                  setSelectedCollege("");
                  setSelectedChair("");
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
