import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { type BudgetItem } from "../../types/rubric";
import BudgetWorksheet from "../../components/BudgetWorksheet";
import axios from "axios";

export default function BudgetManagement() {
  const { grantId } = useParams<{ grantId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [grantTitle, setGrantTitle] = useState<string>("");

  useEffect(() => {
    if (grantId) {
      loadItems();
      loadGrantTitle();
    }
  }, [grantId]);

  const loadGrantTitle = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/grants/${grantId}`,
      );
      setGrantTitle(response.data.title || "Grant");
    } catch {
      setGrantTitle("Grant");
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/budget/${grantId}`,
      );
      setItems(response.data);
    } catch (error) {
      console.error("Failed to load budget items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (
    data: Omit<BudgetItem, "id" | "grantId" | "createdAt" | "updatedAt">,
  ) => {
    try {
      const response = await axios.post("http://localhost:5000/api/budget", {
        ...data,
        grantId,
      });
      setItems((prev) => [...prev, response.data]);
    } catch (error) {
      console.error("Failed to add budget item:", error);
      alert("Failed to add budget item");
    }
  };

  const handleUpdate = async (
    id: string,
    data: Omit<BudgetItem, "id" | "grantId" | "createdAt" | "updatedAt">,
  ) => {
    try {
      await axios.put(`http://localhost:5000/api/budget/${id}`, data);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...data, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    } catch (error) {
      console.error("Failed to update budget item:", error);
      alert("Failed to update budget item");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`http://localhost:5000/api/budget/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to delete budget item:", error);
      alert("Failed to delete budget item");
    }
  };

  if (!grantId) {
    return (
      <div style={styles.container}>
        <p>No grant selected.</p>
        <button style={styles.backButton} onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <button style={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div>
          <h1 style={styles.pageTitle}>Budget Worksheet</h1>
          {grantTitle && <p style={styles.grantLabel}>Grant: {grantTitle}</p>}
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading budget items...</div>
      ) : (
        <BudgetWorksheet
          grantId={grantId}
          items={items}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

const styles = {
  container: { padding: "2rem", maxWidth: "1200px", margin: "0 auto" },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "1.5rem",
    marginBottom: "2rem",
  },
  pageTitle: { margin: "0 0 0.25rem 0", color: "#2c3e50" },
  grantLabel: { margin: 0, color: "#666", fontSize: "0.95rem" },
  backButton: {
    background: "#f0f0f0",
    color: "#333",
    border: "1px solid #ddd",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "0.25rem",
  },
  loading: { textAlign: "center" as const, padding: "3rem", color: "#666" },
};
