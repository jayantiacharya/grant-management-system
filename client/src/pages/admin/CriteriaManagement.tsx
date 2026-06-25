import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { type Criteria } from "../../types/rubric";
import CriteriaForm from "../../components/CriteriaForm";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import DashHeader from "../../components/DashHeader";
import "../Dashboard.css";

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
      <main className="dash-main">
        <div className="dash-welcome">
          <h2>Grant Review Criteria</h2>
          <p>Manage scoring criteria and rating guidelines for grant reviews</p>
          <Link to="/admin" className="edit-btn">
            Back to Admin
          </Link>
        </div>
        <div style={styles.container}>
          <div style={styles.header}>
            <button
              style={styles.primaryButton}
              onClick={() => {
                setEditingCriteria(null);
                setShowForm(true);
              }}
            >
              + Add New Criteria
            </button>
          </div>

          {showForm && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <button
                  style={styles.modalClose}
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
            <div style={styles.loading}>Loading criteria...</div>
          ) : (
            <div style={styles.criteriaList}>
              {criteria.length === 0 && (
                <div style={styles.loading}>
                  No criteria yet. Click "+ Add New Criteria" to get started.
                </div>
              )}
              {criteria.map((criterion) => (
                <div key={criterion._id} style={styles.criteriaCard}>
                  <div style={styles.criteriaHeader}>
                    <div>
                      <h3 style={styles.criteriaTitle}>{criterion.name}</h3>
                      <span style={styles.maxScore}>
                        Max Score: {criterion.maxScore}
                      </span>
                    </div>
                    <div style={styles.criteriaActions}>
                      <button
                        style={styles.editButton}
                        onClick={() => {
                          setEditingCriteria(criterion);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        style={styles.deleteButton}
                        onClick={() => handleDelete(criterion._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p style={styles.criteriaDescription}>
                    {criterion.description}
                  </p>
                  <div>
                    <h4 style={styles.suggestionsTitle}>Rating Guidelines:</h4>
                    <ul style={styles.suggestionsList}>
                      {criterion.ratingSuggestions.map((suggestion, idx) => (
                        <li key={idx} style={styles.suggestionItem}>
                          <strong>{suggestion.score} points:</strong>{" "}
                          {suggestion.description}
                          {suggestion.example && (
                            <span style={styles.example}>
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
        </div>
      </main>
    </div>
  );
}

const styles = {
  container: {
    padding: "2rem",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    marginBottom: "2rem",
  },
  primaryButton: {
    background: "#4a90e2",
    color: "white",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
  },
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    background: "white",
    borderRadius: "12px",
    width: "90%",
    maxWidth: "700px",
    maxHeight: "90vh",
    overflowY: "auto" as const,
    position: "relative" as const,
    padding: "2rem",
  },
  modalClose: {
    position: "absolute" as const,
    top: "1rem",
    right: "1rem",
    background: "none",
    border: "none",
    fontSize: "1.5rem",
    cursor: "pointer",
    color: "#999",
  },
  loading: {
    textAlign: "center" as const,
    padding: "3rem",
    color: "#666",
  },
  criteriaList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem",
  },
  criteriaCard: {
    background: "white",
    borderRadius: "8px",
    padding: "1.5rem",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    border: "1px solid #e0e0e0",
  },
  criteriaHeader: {
    display: "flex",
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: "1rem",
  },
  criteriaTitle: {
    margin: "0 0 0.5rem 0",
    color: "#2c3e50",
  },
  maxScore: {
    display: "inline-block",
    background: "#e8f4f8",
    color: "#2980b9",
    padding: "0.25rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  criteriaActions: {
    display: "flex",
    gap: "0.5rem",
  },
  editButton: {
    background: "#f0f0f0",
    color: "#333",
    border: "1px solid #ddd",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
  },
  deleteButton: {
    background: "#fee",
    color: "#c0392b",
    border: "1px solid #fcc",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
  },
  criteriaDescription: {
    color: "#555",
    marginBottom: "1rem",
    lineHeight: 1.5,
  },
  suggestionsTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.9rem",
    color: "#666",
  },
  suggestionsList: {
    margin: 0,
    paddingLeft: "1.5rem",
  },
  suggestionItem: {
    marginBottom: "0.5rem",
    color: "#555",
  },
  example: {
    color: "#888",
    fontStyle: "italic",
  },
};
