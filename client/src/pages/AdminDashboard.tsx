import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import axios from "axios";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [collegeName, setCollegeName] = useState("");
  const [selectedDean, setSelectedDean] = useState("");

  const [departmentName, setDepartmentName] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");

  const [collegeMessage, setCollegeMessage] = useState("");
  const [departmentMessage, setDepartmentMessage] = useState("");

  const fetchUsers = async () => {
    const { data } = await axios.get("http://localhost:5000/api/admin/users");
    setUsers(data);
  };
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

  const createCollege = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await axios.post("http://localhost:5000/api/admin/createCollege", {
        name: collegeName,
        dean: selectedDean,
      });

      setCollegeName("");
      setSelectedDean("");
      setCollegeMessage("College created successfully!");

      fetchColleges();
    } catch (error) {
      setCollegeMessage("Failed to create college.");
      console.log(error);
    }
  };

  const createDepartment = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await axios.post("http://localhost:5000/api/admin/createDepartment", {
        name: departmentName,
        college: selectedCollege,
      });

      setDepartmentName("");
      setSelectedCollege("");
      setDepartmentMessage("Department created successfully.");

      fetchDepartments();
    } catch (error) {
      setDepartmentMessage("Failed to create department.");
      console.log(error);
    }
  };
  useEffect(() => {
    fetchUsers();
    fetchColleges();
    fetchDepartments();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
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
          <h2>Welcome back</h2>
          <p>Weber State University — Grant Management System</p>
        </div>
        <div className="dash-grid">
          <div className="grant-form-card">
            <h2>Create College</h2>
            <form className="grant-form" onSubmit={createCollege}>
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

                  {users.map((user: any) => (
                    <option key={user.id} value={user.email}>
                      {user.email}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="submit-btn">
                Create College
              </button>
            </form>
            <p>{collegeMessage}</p>
          </div>

          <div className="grant-form-card">
            <h2>Create Department</h2>

            <form className="grant-form" onSubmit={createDepartment}>
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
                    <option key={college.id} value={college.name}>
                      {college.name}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="submit-btn">
                Create Department
              </button>
            </form>
            <p>{departmentMessage}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
