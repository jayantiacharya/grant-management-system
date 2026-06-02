import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import axios from "axios";

import { useAuth } from "../context/AuthContext";

import "./Dashboard.css";

export type UserOption = {
  id: string;
  email: string;
};

type YesNo = "" | "yes" | "no";

type BudgetItem = {
  itemDescription: string;
  category: string;
  amountRequested: string;
  amountFromARCC: string;
  amountFromCollege: string;
  amountFromDepartment: string;
  amountFromOtherSources: string;
};

export type GrantSubmission = {
  title: string;
  description: string;
  projectDirectorId: string;
  studentsImpacted: number;
  affectsMultipleDepartments: YesNo;
  departmentCount: string;
  usesSubjects: YesNo;
  irbApproved: YesNo;
};

type GrantFormState = Omit<GrantSubmission, "studentsImpacted"> & {
  studentsImpacted: string;
};

type GrantFormErrors = Partial<Record<keyof GrantFormState | "files", string>>;

const MAX_FILES = 3;

const emptyBudgetItem: BudgetItem = {
  itemDescription: "",
  category: "",
  amountRequested: "",
  amountFromARCC: "",
  amountFromCollege: "",
  amountFromDepartment: "",
  amountFromOtherSources: "",
};

export default function NewGrant() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<GrantFormState>({
    title: "",
    description: "",
    projectDirectorId: user?.id ?? "",
    studentsImpacted: "",
    affectsMultipleDepartments: "",
    departmentCount: "",
    usesSubjects: "",
    irbApproved: "",
  });

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([
    { ...emptyBudgetItem },
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<GrantFormErrors>({});
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    axios
      .get("http://localhost:5000/api/admin/user-options", {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then((res) => setUsers(res.data))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setUsers([]);
        const fallback = "Failed to load project directors.";
        if (axios.isAxiosError(err)) {
          setMessage(err.response?.data?.message ?? fallback);
        } else {
          setMessage(fallback);
        }
      });
    return () => controller.abort();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setMessage("");
  };

  const handleBudgetItemChange = (
    index: number,
    field: keyof BudgetItem,
    value: string,
  ) => {
    const updatedItems = [...budgetItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };
    setBudgetItems(updatedItems);
    setMessage("");
  };

  const addBudgetItem = () => {
    setBudgetItems([...budgetItems, { ...emptyBudgetItem }]);
  };

  const removeBudgetItem = (index: number) => {
    if (budgetItems.length === 1) return;
    setBudgetItems(budgetItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const getBudgetTotal = (field: keyof BudgetItem) => {
    return budgetItems.reduce((total, item) => {
      return total + Number(item[field] || 0);
    }, 0);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > MAX_FILES) {
      setErrors((prev) => ({
        ...prev,
        files: `Maximum ${MAX_FILES} files allowed.`,
      }));
      e.target.value = "";
      setFiles([]);
      return;
    }
    setFiles(selected);
    setErrors((prev) => ({ ...prev, files: undefined }));
    setMessage("");
  };

  const validate = (
    data: GrantFormState,
    selectedFiles: File[],
  ): GrantFormErrors => {
    const next: GrantFormErrors = {};
    if (!data.title.trim()) next.title = "Title is required.";
    if (!data.description.trim()) next.description = "Description is required.";
    if (!data.projectDirectorId)
      next.projectDirectorId = "Select a project director.";
    const n = Number(data.studentsImpacted);
    if (data.studentsImpacted === "" || !Number.isInteger(n) || n < 0) {
      next.studentsImpacted =
        "Students impacted must be a non-negative integer.";
    }
    if (!data.affectsMultipleDepartments) {
      next.affectsMultipleDepartments = "Please select an option.";
    } else if (data.affectsMultipleDepartments === "yes") {
      const d = Number(data.departmentCount);
      if (data.departmentCount === "" || !Number.isInteger(d) || d < 2) {
        next.departmentCount = "Enter a number of departments (2 or more).";
      }
    }
    if (!data.usesSubjects) {
      next.usesSubjects = "Please select an option.";
    } else if (data.usesSubjects === "yes") {
      if (data.irbApproved !== "yes") {
        next.irbApproved =
          "IRB approval is required when human or animal subjects are used.";
      }
      if (selectedFiles.length === 0) {
        next.files =
          "File upload is required when human or animal subjects are used.";
      }
    }
    if (selectedFiles.length > MAX_FILES) {
      next.files = `Maximum ${MAX_FILES} files allowed.`;
    }
    return next;
  };

  const submitGrant = async () => {
    const selectedFiles = Array.from(fileInputRef.current?.files ?? []);
    const validationErrors = validate(formData, selectedFiles);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    setMessage("");

    try {
      const useMultipart = selectedFiles.length > 0;

      let response;
      if (useMultipart) {
        const body = new FormData();
        body.append("title", formData.title);
        body.append("description", formData.description);
        body.append("projectDirectorId", formData.projectDirectorId);
        body.append(
          "studentsImpacted",
          String(Number(formData.studentsImpacted)),
        );
        body.append(
          "affectsMultipleDepartments",
          formData.affectsMultipleDepartments,
        );
        if (formData.affectsMultipleDepartments === "yes") {
          body.append("departmentCount", formData.departmentCount);
        }
        body.append("usesSubjects", formData.usesSubjects);
        if (formData.usesSubjects === "yes") {
          body.append("irbApproved", formData.irbApproved);
        }

        body.append("budgetItems", JSON.stringify(budgetItems));

        selectedFiles.forEach((file) => body.append("files", file));

        response = await axios.post(
          "http://localhost:5000/api/grants/submit",
          body,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
          },
        );
      } else {
        const payload = {
          title: formData.title,
          description: formData.description,
          projectDirectorId: formData.projectDirectorId,
          studentsImpacted: Number(formData.studentsImpacted),
          affectsMultipleDepartments: formData.affectsMultipleDepartments,
          departmentCount:
            formData.affectsMultipleDepartments === "yes"
              ? formData.departmentCount
              : "",
          usesSubjects: formData.usesSubjects,
          irbApproved:
            formData.usesSubjects === "yes" ? formData.irbApproved : "",
          budgetItems,
        };

        response = await axios.post(
          "http://localhost:5000/api/grants/submit",
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      }

      void response;
      setMessage("Grant proposal submitted successfully.");

      setFormData({
        title: "",
        description: "",
        projectDirectorId: user?.id ?? "",
        studentsImpacted: "",
        affectsMultipleDepartments: "",
        departmentCount: "",
        usesSubjects: "",
        irbApproved: "",
      });
      setBudgetItems([{ ...emptyBudgetItem }]);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setErrors({});
    } catch (error) {
      const fallback = "Failed to submit proposal.";
      if (axios.isAxiosError(error)) {
        setMessage(error.response?.data?.message ?? fallback);
      } else {
        setMessage(fallback);
      }
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

          <button onClick={() => navigate("/dashboard")} className="logout-btn">
            Back to dashboard
          </button>

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

          <form
            className="grant-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitGrant();
            }}
          >
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
              {errors.title && (
                <span className="field-error">{errors.title}</span>
              )}
            </div>

            <div>
              <label htmlFor="description">Description</label>

              <textarea
                id="description"
                name="description"
                rows={12}
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter a detailed grant description"
                required
              />
              {errors.description && (
                <span className="field-error">{errors.description}</span>
              )}
            </div>

            <div>
              <label htmlFor="projectDirectorId">
                Project Director / Principal Investigator
              </label>

              <select
                id="projectDirectorId"
                name="projectDirectorId"
                value={formData.projectDirectorId}
                onChange={handleChange}
                required
              >
                {user && !users.some((u) => u.id === user.id) && (
                  <option value={user.id}>{user.email}</option>
                )}
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
              {errors.projectDirectorId && (
                <span className="field-error">{errors.projectDirectorId}</span>
              )}
            </div>

            <div>
              <label htmlFor="studentsImpacted">
                Weber State University students impacted
              </label>

              <input
                type="number"
                id="studentsImpacted"
                name="studentsImpacted"
                min={0}
                step={1}
                value={formData.studentsImpacted}
                onChange={handleChange}
                placeholder="0"
                required
              />
              {errors.studentsImpacted && (
                <span className="field-error">{errors.studentsImpacted}</span>
              )}
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
              {errors.affectsMultipleDepartments && (
                <span className="field-error">
                  {errors.affectsMultipleDepartments}
                </span>
              )}
            </div>

            {formData.affectsMultipleDepartments === "yes" && (
              <div>
                <label htmlFor="departmentCount">How many departments?</label>

                <input
                  type="number"
                  id="departmentCount"
                  name="departmentCount"
                  min={2}
                  step={1}
                  value={formData.departmentCount}
                  onChange={handleChange}
                  placeholder="Enter number of departments"
                  required
                />
                {errors.departmentCount && (
                  <span className="field-error">{errors.departmentCount}</span>
                )}
              </div>
            )}

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
              {errors.usesSubjects && (
                <span className="field-error">{errors.usesSubjects}</span>
              )}
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
                {errors.irbApproved && (
                  <span className="field-error">{errors.irbApproved}</span>
                )}
              </div>
            )}

            <div className="budget-section">
              <h3>Budget Worksheet</h3>

              {budgetItems.map((item, index) => (
                <div key={index} className="budget-item-card">
                  <h4>Budget Item {index + 1}</h4>

                  <div>
                    <label htmlFor={`itemDescription-${index}`}>
                      Item Description
                    </label>
                    <input
                      type="text"
                      id={`itemDescription-${index}`}
                      value={item.itemDescription}
                      onChange={(e) =>
                        handleBudgetItemChange(
                          index,
                          "itemDescription",
                          e.target.value,
                        )
                      }
                      placeholder="Example: Laptop, software license, supplies"
                    />
                  </div>

                  <div>
                    <label htmlFor={`category-${index}`}>Category</label>
                    <input
                      type="text"
                      id={`category-${index}`}
                      value={item.category}
                      onChange={(e) =>
                        handleBudgetItemChange(
                          index,
                          "category",
                          e.target.value,
                        )
                      }
                      placeholder="Example: Hardware or Software"
                    />
                  </div>

                  <div>
                    <label htmlFor={`amountRequested-${index}`}>
                      Amount Requested
                    </label>
                    <input
                      type="number"
                      id={`amountRequested-${index}`}
                      min={0}
                      step="0.01"
                      value={item.amountRequested}
                      onChange={(e) =>
                        handleBudgetItemChange(
                          index,
                          "amountRequested",
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label htmlFor={`amountFromARCC-${index}`}>
                      Amount from ARCC
                    </label>
                    <input
                      type="number"
                      id={`amountFromARCC-${index}`}
                      min={0}
                      step="0.01"
                      value={item.amountFromARCC}
                      onChange={(e) =>
                        handleBudgetItemChange(
                          index,
                          "amountFromARCC",
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label htmlFor={`amountFromCollege-${index}`}>
                      Amount from College
                    </label>
                    <input
                      type="number"
                      id={`amountFromCollege-${index}`}
                      min={0}
                      step="0.01"
                      value={item.amountFromCollege}
                      onChange={(e) =>
                        handleBudgetItemChange(
                          index,
                          "amountFromCollege",
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label htmlFor={`amountFromDepartment-${index}`}>
                      Amount from Department
                    </label>
                    <input
                      type="number"
                      id={`amountFromDepartment-${index}`}
                      min={0}
                      step="0.01"
                      value={item.amountFromDepartment}
                      onChange={(e) =>
                        handleBudgetItemChange(
                          index,
                          "amountFromDepartment",
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label htmlFor={`amountFromOtherSources-${index}`}>
                      Amount from Other Sources
                    </label>
                    <input
                      type="number"
                      id={`amountFromOtherSources-${index}`}
                      min={0}
                      step="0.01"
                      value={item.amountFromOtherSources}
                      onChange={(e) =>
                        handleBudgetItemChange(
                          index,
                          "amountFromOtherSources",
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  {budgetItems.length > 1 && (
                    <button
                      type="button"
                      className="remove-budget-btn"
                      onClick={() => removeBudgetItem(index)}
                    >
                      Remove Budget Item
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="submit-btn"
                onClick={addBudgetItem}
              >
                Add Budget Item
              </button>

              <small className="budget-total">
                Total Requested: ${getBudgetTotal("amountRequested").toFixed(2)}
              </small>
            </div>

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

              <small>Maximum {MAX_FILES} files allowed.</small>

              {files.length > 0 && (
                <small>{files.length} file(s) selected.</small>
              )}

              {errors.files && (
                <span className="field-error">{errors.files}</span>
              )}
            </div>

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
