import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRef, useState } from "react";
import axios from "axios";

import "./Dashboard.css";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    affectsMultipleDepartments: "",
    departmentCount: "",
    usesSubjects: "",
    irbApproved: "",
  });

  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length > 3) {
      setMessage("You can upload a maximum of 3 files.");
      e.target.value = "";
      setFiles([]);
      return;
    }

    setFiles(selectedFiles);
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedFiles = Array.from(fileInputRef.current?.files || []);

    if (
      formData.affectsMultipleDepartments === "yes" &&
      (!formData.departmentCount || Number(formData.departmentCount) < 2)
    ) {
      setMessage("Please enter how many departments are affected.");
      return;
    }

    if (formData.usesSubjects === "yes" && formData.irbApproved !== "yes") {
      setMessage("IRB approval is required for projects using human or animal subjects.");
      return;
    }

    if (formData.usesSubjects === "yes" && selectedFiles.length === 0) {
      setMessage("File upload is required when human or animal subjects are used.");
      return;
    }

    if (selectedFiles.length > 3) {
      setMessage("You can upload a maximum of 3 files.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const submitData = new FormData();

      submitData.append("title", formData.title);
      submitData.append("description", formData.description);
      submitData.append("submittedEmail", user?.email || "");
      submitData.append("affectsMultipleDepartments", formData.affectsMultipleDepartments);
      submitData.append("departmentCount", formData.departmentCount);
      submitData.append("usesSubjects", formData.usesSubjects);
      submitData.append("irbApproved", formData.irbApproved);

      selectedFiles.forEach((file) => {
        submitData.append("files", file);
      });

      await axios.post("http://localhost:5000/api/grants/submit", submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("Grant proposal submitted successfully.");

      setFormData({
        title: "",
        description: "",
        affectsMultipleDepartments: "",
        departmentCount: "",
        usesSubjects: "",
        irbApproved: "",
      });

      setFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
                rows={5}
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter grant description"
                required
              />
            </div>

            <div>
              <label htmlFor="affectsMultipleDepartments">
                Does this grant affect more than one department?
              </label>

              <select
                id="affectsMultipleDepartments"
                name="affectsMultipleDepartments"
                value={formData.affectsMultipleDepartments}
                onChange={handleChange}
                required
              >
                <option value="">Select an option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {formData.affectsMultipleDepartments === "yes" && (
              <div>
                <label htmlFor="departmentCount">How many departments?</label>

                <input
                  type="number"
                  id="departmentCount"
                  name="departmentCount"
                  value={formData.departmentCount}
                  onChange={handleChange}
                  placeholder="Enter number of departments"
                  min="2"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="files">Upload Files</label>

              <input
                ref={fileInputRef}
                type="file"
                id="files"
                name="files"
                onChange={handleFileChange}
                multiple
                required={formData.usesSubjects === "yes"}
              />

              <small>Maximum 3 files allowed.</small>

              {files.length > 0 && (
                <small>{files.length} file selected.</small>
              )}
            </div>

            <div>
              <label htmlFor="usesSubjects">
                Does this project use human or animal subjects?
              </label>

              <select
                id="usesSubjects"
                name="usesSubjects"
                value={formData.usesSubjects}
                onChange={handleChange}
                required
              >
                <option value="">Select an option</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {formData.usesSubjects === "yes" && (
              <div>
                <label htmlFor="irbApproved">
                  Has IRB approval been completed?
                </label>

                <select
                  id="irbApproved"
                  name="irbApproved"
                  value={formData.irbApproved}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select an option</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            )}

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