import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";

import "./Dashboard.css";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [userData, setUserData] = useState({});
  const [isEditing, setIsEditing] = useState(false);
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
  const fetchUserData = async () => {
    const { data } = await axios.get(
      `http://localhost:5000/api/auth/get-user/${user?.id}`,
    );
    setUserData(data.user);
    console.log("Fetched user data:", data.user);
  };

  const [userFormData, setUserFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    college: "",
  });

  useEffect(() => {
    fetchColleges();
    fetchDepartments();
    fetchUserData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  const handleBack = () => {
    navigate("/dashboard");
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setUserFormData({
      ...userFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (userFormData.password !== userFormData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    await axios.post("http://localhost:5000/api/auth/update-user", {
      userId: user?.id,
      ...userFormData,
    });
    setIsEditing(false);
  };

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>

        <div className="dash-user">
          <button onClick={handleBack} className="logout-btn">
            Back
          </button>
          <button onClick={handleLogout} className="logout-btn">
            Sign out
          </button>
        </div>
      </header>

      <main className="dash-main">
        {!isEditing ? (
          <div className="profile-view">
            <h2>Profile Information</h2>

            <p>
              <strong>Name:</strong> {userData.firstName} {userData.lastName}
            </p>

            <p>
              <strong>Email:</strong> {userData.email}
            </p>

            <p>
              <strong>College:</strong> {userData.college}
            </p>

            <p>
              <strong>Department:</strong> {userData.department}
            </p>
            <button onClick={() => setIsEditing(true)}>Edit Profile</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grant-form-card">
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={userData.firstName}
              onChange={handleChange}
            />

            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={userData.lastName}
              onChange={handleChange}
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={userData.email}
              onChange={handleChange}
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={userFormData.password}
              onChange={handleChange}
            />

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={userFormData.confirmPassword}
              onChange={handleChange}
            />
            <select
              name="college"
              value={userData.college}
              onChange={handleChange}
            >
              <option value="">Select College</option>

              {colleges.map((college) => (
                <option key={college._id} value={college.name}>
                  {college.name}
                </option>
              ))}
            </select>

            <select
              name="department"
              value={userData.department}
              onChange={handleChange}
            >
              <option value="">Select Department</option>

              {departments.map((department) => (
                <option key={department._id} value={department.name}>
                  {department.name}
                </option>
              ))}
            </select>

            <div className="form-buttons">
              <button type="submit">Save</button>

              <button type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
