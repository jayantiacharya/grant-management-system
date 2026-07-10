import { useState, useEffect } from "react";
import { type Criteria } from "../../types/rubric";
import CriteriaForm from "../../components/CriteriaForm";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import DashHeader from "../../components/DashHeader";
import "../../styles/PageLayout.css";
import "../../styles/CriteriaManagement.css";

export default function CriteriaManagement() {
  const { token } = useAuth();
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<Criteria | null>(null);
  const [loading, setLoading] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    loadCriteria();
  }, []);

  const loadCriteria = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http://localhost:5000/api/criteria",
        authHeaders,
      );
      setCriteria(response.data);
    } catch (error) {
      console.error("Failed to load criteria:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (criteriaData: Partial<Criteria>) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/criteria",
        criteriaData,
        authHeaders,
      );
      setCriteria([...criteria, response.data]);
      setShowForm(false);
    } catch (error) {
      console.error("Failed to create criteria:", error);
      alert("Failed to create criteria");
    }
  };

  const handleUpdate = async (id: string, criteriaData: Partial<Criteria>) => {
    try {
      await axios.put(
        `http://localhost:5000/api/criteria/${id}`,
        criteriaData,
        authHeaders,
      );
      setCriteria(
        criteria.map((c) =>
          c._id === id
            ? { ...c, ...criteriaData, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
      setEditingCriteria(null);
      setShowForm(false);
    } catch (error) {
      console.error("Failed to update criteria:", error);
      alert("Failed to update criteria");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this criteria?")) return;
    try {
      await axios.delete(
        `http://localhost:5000/api/criteria/${id}`,
        authHeaders,
      );
      setCriteria(criteria.filter((c) => c._id !== id));
    } catch (error) {
      console.error("Failed to delete criteria:", error);
      alert("Failed to delete criteria");
    }
  };

  return (
    <div className="dashboard-page">
      <DashHeader />

      <main className="criteria-mgmt-container">
        <section className="criteria-mgmt-hero">
          <div>
            <p className="criteria-mgmt-eyebrow">Admin Management</p>
            <h1 className="criteria-mgmt-hero-title">Grant Review Criteria</h1>
            <p className="criteria-mgmt-hero-text">
              Create, edit, and manage the scoring criteria used by reviewers.
            </p>
          </div>

          <button
            className="criteria-mgmt-primary-button"
            onClick={() => {
              setEditingCriteria(null);
              setShowForm(true);
            }}
          >
            + Add New Criteria
          </button>
        </section>

        {showForm && (
          <div className="criteria-mgmt-modal-overlay">
            <div className="criteria-mgmt-modal-content">
              <button
                className="criteria-mgmt-modal-close"
                onClick={() => {
                  setShowForm(false);
                  setEditingCriteria(null);
                }}
              >
                ×
              </button>

              <CriteriaForm
                initialData={editingCriteria || undefined}
                onSubmit={(data) => {
                  if (editingCriteria) {
                    handleUpdate(editingCriteria._id, data);
                  } else {
                    handleCreate(data);
                  }
                }}
                onCancel={() => {
                  setShowForm(false);
                  setEditingCriteria(null);
                }}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="criteria-mgmt-loading">Loading criteria...</div>
        ) : (
          <div className="criteria-mgmt-list">
            {criteria.length === 0 && (
              <div className="criteria-mgmt-loading">
                No criteria yet. Click "+ Add New Criteria" to get started.
              </div>
            )}

            {criteria.map((criterion) => (
              <div key={criterion._id} className="criteria-mgmt-card">
                <div className="criteria-mgmt-card-header">
                  <div>
                    <h3 className="criteria-mgmt-card-title">
                      {criterion.name}
                    </h3>
                    <span className="criteria-mgmt-max-score">
                      Max Score: {criterion.maxScore}
                    </span>
                  </div>

                  <div className="criteria-mgmt-card-actions">
                    <button
                      className="criteria-mgmt-edit-button"
                      onClick={() => {
                        setEditingCriteria(criterion);
                        setShowForm(true);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="criteria-mgmt-delete-button"
                      onClick={() => handleDelete(criterion._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="criteria-mgmt-description">
                  {criterion.description}
                </p>

                <div>
                  <h4 className="criteria-mgmt-suggestions-title">
                    Rating Guidelines:
                  </h4>
                  <ul className="criteria-mgmt-suggestions-list">
                    {criterion.ratingSuggestions.map((suggestion, idx) => (
                      <li key={idx} className="criteria-mgmt-suggestion-item">
                        <strong>{suggestion.score} points:</strong>{" "}
                        {suggestion.description}
                        {suggestion.example && (
                          <span className="criteria-mgmt-example">
                            {" "}
                            ({suggestion.example})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
