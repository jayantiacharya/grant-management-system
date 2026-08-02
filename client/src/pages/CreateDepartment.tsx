import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "../styles/PageLayout.css";
import "../styles/AdminManagement.css";
import "../styles/GrantForm.css";

export default function CreateDepartment() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

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

  const handleDeleteDepartment = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Delete "${name}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setMessage("");
    try {
      await axios.post(
        "http://localhost:5000/api/admin/deleteDepartment",
        { id },
        authHeader,
      );
      setMessage(`"${name}" deleted successfully.`);
      fetchDepartments();
    } catch (error: any) {
      setMessage(
        error.response?.data?.message || "Failed to delete department.",
      );
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
    fetchDepartments();
    fetchUsers();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      if (editingId) {
        await axios.post(
          "http://localhost:5000/api/admin/updateDepartment",
          {
            id: editingId,
            name: departmentName,
            college: selectedCollege,
            chair: selectedChair,
          },
          authHeader,
        );
        setMessage("Department updated successfully.");
      } else {
        await axios.post(
          "http://localhost:5000/api/admin/createDepartment",
          {
            name: departmentName,
            college: selectedCollege,
            chair: selectedChair,
          },
          authHeader,
        );
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
      <DashHeader />

      <main className="management-main">
        <section className="management-hero">
          <div>
            <p className="admin-eyebrow">Admin Management</p>
            <h1>Department Management</h1>
            <p>
              Create departments, connect them to colleges, and assign
              department chairs.
            </p>
          </div>
        </section>

        {message && <p className="form-message">{message}</p>}

        <section className="management-grid">
          <div className="management-card">
            <div className="management-card-header">
              <span className="management-icon">🏢</span>
              <div>
                <h2>Departments</h2>
                <p>Existing departments in the system.</p>
              </div>
            </div>

            {!departments.length ? (
              <p className="empty-message">No departments yet.</p>
            ) : (
              <ul className="management-list">
                {departments.map((department: any) => (
                  <li
                    key={department.id ?? department._id ?? department.name}
                    className="management-row"
                  >
                    <span>
                      <strong>{department.name}</strong>
                      <small>
                        {department.college || "College not assigned"} —{" "}
                        {department.chair || "Chair not assigned"}
                      </small>
                    </span>

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

                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() =>
                        handleDeleteDepartment(
                          String(department.id ?? department._id ?? ""),
                          department.name,
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
                <h2>{editingId ? "Edit Department" : "Create Department"}</h2>
                <p>
                  {editingId
                    ? "Update the selected department information."
                    : "Add a new department and assign its college and chair."}
                </p>
              </div>
            </div>

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
                    <option
                      key={college.id ?? college.name}
                      value={college.name}
                    >
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
                {editingId ? "Save Changes" : "Create Department"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="save-btn"
                  onClick={() => {
                    setEditingId("");
                    setDepartmentName("");
                    setSelectedCollege("");
                    setSelectedChair("");
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
