import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

const COLLEGES = [
  "College of Applied Science & Technology",
  "College of Arts & Humanities",
  "College of Business & Economics",
  "College of Education",
  "College of Engineering, Applied Science & Technology",
  "College of Health Professions",
  "College of Science",
  "College of Social & Behavioral Sciences",
  "Dumke College of Health Professions",
];

const DEPARTMENTS: Record<string, string[]> = {
  "College of Applied Science & Technology": [
    "Automotive Technology",
    "Computer & Networking Technology",
    "Construction & Building Sciences",
    "Electronics & Biomedical Technology",
    "Interior Design & Culinary Arts",
    "Manufacturing & Mechanical Engineering Technology",
  ],
  "College of Arts & Humanities": [
    "Art & Design",
    "Communication",
    "English",
    "History",
    "Modern Languages",
    "Music",
    "Philosophy",
    "Theatre Arts",
  ],
  "College of Business & Economics": [
    "Accounting",
    "Economics",
    "Finance & Economics",
    "Management",
    "Marketing & Supply Chain",
  ],
  "College of Education": [
    "Curriculum & Instruction",
    "Early Childhood Education",
    "Educational Leadership",
    "Health Promotion & Human Performance",
    "Teacher Education",
  ],
  "College of Engineering, Applied Science & Technology": [
    "Civil & Environmental Engineering",
    "Computer Science",
    "Electrical & Computer Engineering",
    "Engineering Technology",
    "Mechanical Engineering",
  ],
  "College of Health Professions": [
    "Clinical & Health Sciences",
    "Dental Hygiene",
    "Health Administrative Services",
    "Medical Laboratory Sciences",
    "Radiologic Sciences",
    "Respiratory Therapy",
  ],
  "College of Science": [
    "Botany",
    "Chemistry & Biochemistry",
    "Geosciences",
    "Mathematics",
    "Microbiology",
    "Physics",
    "Zoology",
  ],
  "College of Social & Behavioral Sciences": [
    "Anthropology",
    "Criminal Justice",
    "Geography",
    "Political Science & Philosophy",
    "Psychology",
    "Social Work",
    "Sociology",
  ],
  "Dumke College of Health Professions": ["Nursing", "Physical Therapy"],
};

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    birthday: "",
    email: "",
    college: "",
    department: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Get today's date in YYYY-MM-DD format for max attribute
  const today = new Date().toISOString().slice(0, 10);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "college" ? { department: "" } : {}),
    }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(
        "http://localhost:5000/api/auth/register",
        form,
      );
      login(data.user, data.token);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const availableDepartments = form.college
    ? (DEPARTMENTS[form.college] ?? [])
    : [];

  return (
    <div className="auth-page">
      <div
        className="auth-card"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="auth-header">
          <div className="auth-logo">GMS</div>
          <h1>Create Account</h1>
          <p>Weber State University</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="field">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={form.firstName}
              onChange={handleChange}
              placeholder="Jane"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="lastName">Last Name</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={form.lastName}
              onChange={handleChange}
              placeholder="Doe"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="birthday">Date of Birth</label>
            <input
              id="birthday"
              name="birthday"
              type="date"
              value={form.birthday}
              onChange={handleChange}
              min="1900-01-01"
              max={today}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@weber.edu"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="college">College</label>
            <select
              id="college"
              name="college"
              value={form.college}
              onChange={handleChange}
              required
            >
              <option value="">— Select a college —</option>
              {COLLEGES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              name="department"
              value={form.department}
              onChange={handleChange}
              required
              disabled={!form.college}
            >
              <option value="">— Select a department —</option>
              {availableDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 6 characters"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              required
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
