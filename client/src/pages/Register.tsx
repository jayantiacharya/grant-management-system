import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

type College = { id: string; name: string };
type Department = { id: string; name: string; college: string };

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
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const [collegesRes, departmentsRes] = await Promise.all([
          axios.get<College[]>("http://localhost:5000/api/admin/colleges"),
          axios.get<Department[]>(
            "http://localhost:5000/api/admin/departments",
          ),
        ]);
        setColleges(collegesRes.data);
        setDepartments(departmentsRes.data);
      } catch {
        setError("Failed to load colleges and departments");
      }
    };
    fetchCatalog();
  }, []);

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
    ? departments.filter((d) => d.college === form.college)
    : [];

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-scrollable">
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
              {colleges.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
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
                <option key={d.id} value={d.name}>
                  {d.name}
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
