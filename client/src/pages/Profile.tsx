import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import axios from "axios";

import DashHeader from "../components/DashHeader";
import "./Dashboard.css";

type College = {
  _id: string;
  name: string;
};

type Department = {
  _id: string;
  name: string;
};

type UserData = {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  college: string;
};

export default function Profile() {
  const { user } = useAuth();

  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userData, setUserData] = useState<UserData>({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    college: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [userFormData, setUserFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    college: "",
  });

  const fetchColleges = async () => {
    const { data } = await axios.get(
      "http://localhost:5000/api/admin/colleges",
    );
    setColleges(Array.isArray(data) ? data : []);
  };

  const fetchDepartments = async () => {
    const { data } = await axios.get(
      "http://localhost:5000/api/admin/departments",
    );
    setDepartments(Array.isArray(data) ? data : []);
  };

  const fetchUserData = async (userId: string) => {
    const { data } = await axios.get(
      `http://localhost:5000/api/auth/get-user/${userId}`,
    );

    setUserData(data.user);
    setUserFormData({
      firstName: data.user.firstName || "",
      lastName: data.user.lastName || "",
      email: data.user.email || "",
      password: "",
      confirmPassword: "",
      department: data.user.department || "",
      college: data.user.college || "",
    });
  };

  useEffect(() => {
    fetchColleges();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchUserData(user.id);
  }, [user?.id]);

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

    if (!user?.id) return;

    if (userFormData.password !== userFormData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    await axios.post("http://localhost:5000/api/auth/update-user", {
      userId: user.id,
      ...userFormData,
    });

    await fetchUserData(user.id);
    setIsEditing(false);
  };

  return (
    <div className="dashboard-page">
      <DashHeader
        back={{
          label: "Back",
          to: user?.role === "admin" ? "/admin" : "/dashboard",
        }}
      />

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
              value={userFormData.firstName}
              onChange={handleChange}
            />

            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={userFormData.lastName}
              onChange={handleChange}
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={userFormData.email}
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
              value={userFormData.college}
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
              value={userFormData.department}
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
