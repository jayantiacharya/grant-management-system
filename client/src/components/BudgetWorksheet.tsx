import { useState } from "react";
import { type BudgetItem, BUDGET_CATEGORIES } from "../types/rubric";

interface BudgetItemFormData {
  itemDescription: string;
  amountRequested: number;
  amountFromARCC: number;
  amountFromCollege: number;
  amountFromDepartment: number;
  amountFromOther: number;
  category: string;
}

const emptyForm = (): BudgetItemFormData => ({
  itemDescription: "",
  amountRequested: 0,
  amountFromARCC: 0,
  amountFromCollege: 0,
  amountFromDepartment: 0,
  amountFromOther: 0,
  category: "Other",
});

interface BudgetWorksheetProps {
  grantId: string;
  items: BudgetItem[];
  onAdd: (data: BudgetItemFormData) => void;
  onUpdate: (id: string, data: BudgetItemFormData) => void;
  onDelete: (id: string) => void;
}

export default function BudgetWorksheet({
  grantId,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: BudgetWorksheetProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState<BudgetItemFormData>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    const numericFields = [
      "amountRequested",
      "amountFromARCC",
      "amountFromCollege",
      "amountFromDepartment",
      "amountFromOther",
    ];
    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? parseFloat(value) || 0 : value,
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.itemDescription.trim())
      newErrors.itemDescription = "Item description is required";
    if (formData.amountRequested < 0)
      newErrors.amountRequested = "Amount cannot be negative";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (editingItem) {
      onUpdate(editingItem.id, formData);
    } else {
      onAdd(formData);
    }
    setShowForm(false);
    setEditingItem(null);
    setFormData(emptyForm());
  };

  const handleEdit = (item: BudgetItem) => {
    setEditingItem(item);
    setFormData({
      itemDescription: item.itemDescription,
      amountRequested: item.amountRequested,
      amountFromARCC: item.amountFromARCC,
      amountFromCollege: item.amountFromCollege,
      amountFromDepartment: item.amountFromDepartment,
      amountFromOther: item.amountFromOther,
      category: item.category,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData(emptyForm());
    setErrors({});
  };

  const totalRequested = items.reduce((sum, i) => sum + i.amountRequested, 0);
  const totalARCC = items.reduce((sum, i) => sum + i.amountFromARCC, 0);
  const totalCollege = items.reduce((sum, i) => sum + i.amountFromCollege, 0);
  const totalDepartment = items.reduce(
    (sum, i) => sum + i.amountFromDepartment,
    0,
  );
  const totalOther = items.reduce((sum, i) => sum + i.amountFromOther, 0);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Budget Worksheet</h2>
        <button
          style={styles.primaryButton}
          onClick={() => {
            setEditingItem(null);
            setFormData(emptyForm());
            setShowForm(true);
          }}
        >
          + Add Budget Item
        </button>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>
            {editingItem ? "Edit Budget Item" : "New Budget Item"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              <div style={{ ...styles.formGroup, gridColumn: "1 / -1" }}>
                <label>Item Description *</label>
                <input
                  type="text"
                  name="itemDescription"
                  value={formData.itemDescription}
                  onChange={handleChange}
                  placeholder="e.g., MacBook Pro for lab use"
                  style={styles.input}
                />
                {errors.itemDescription && (
                  <span style={styles.error}>{errors.itemDescription}</span>
                )}
              </div>

              <div style={styles.formGroup}>
                <label>Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  style={styles.input}
                >
                  {BUDGET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label>Amount Requested ($)</label>
                <input
                  type="number"
                  name="amountRequested"
                  value={formData.amountRequested}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  style={styles.input}
                />
                {errors.amountRequested && (
                  <span style={styles.error}>{errors.amountRequested}</span>
                )}
              </div>

              <div style={styles.formGroup}>
                <label>Amount from ARCC ($)</label>
                <input
                  type="number"
                  name="amountFromARCC"
                  value={formData.amountFromARCC}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Amount from College ($)</label>
                <input
                  type="number"
                  name="amountFromCollege"
                  value={formData.amountFromCollege}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Amount from Department ($)</label>
                <input
                  type="number"
                  name="amountFromDepartment"
                  value={formData.amountFromDepartment}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label>Amount from Other Sources ($)</label>
                <input
                  type="number"
                  name="amountFromOther"
                  value={formData.amountFromOther}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.formActions}>
              <button
                type="button"
                onClick={handleCancel}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button type="submit" style={styles.submitButton}>
                {editingItem ? "Update Item" : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      )}

      {items.length === 0 ? (
        <div style={styles.empty}>
          No budget items yet. Click "+ Add Budget Item" to get started.
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Item Description</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Requested</th>
                <th style={styles.th}>From ARCC</th>
                <th style={styles.th}>From College</th>
                <th style={styles.th}>From Dept.</th>
                <th style={styles.th}>From Other</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{item.itemDescription}</td>
                  <td style={styles.td}>
                    <span style={styles.categoryBadge}>{item.category}</span>
                  </td>
                  <td style={styles.td}>{fmt(item.amountRequested)}</td>
                  <td style={styles.td}>{fmt(item.amountFromARCC)}</td>
                  <td style={styles.td}>{fmt(item.amountFromCollege)}</td>
                  <td style={styles.td}>{fmt(item.amountFromDepartment)}</td>
                  <td style={styles.td}>{fmt(item.amountFromOther)}</td>
                  <td style={styles.td}>
                    <div style={styles.rowActions}>
                      <button
                        style={styles.editButton}
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        style={styles.deleteButton}
                        onClick={() => {
                          if (confirm("Delete this item?")) onDelete(item.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={styles.totalRow}>
                <td style={styles.td} colSpan={2}>
                  <strong>Total</strong>
                </td>
                <td style={styles.td}>
                  <strong>{fmt(totalRequested)}</strong>
                </td>
                <td style={styles.td}>
                  <strong>{fmt(totalARCC)}</strong>
                </td>
                <td style={styles.td}>
                  <strong>{fmt(totalCollege)}</strong>
                </td>
                <td style={styles.td}>
                  <strong>{fmt(totalDepartment)}</strong>
                </td>
                <td style={styles.td}>
                  <strong>{fmt(totalOther)}</strong>
                </td>
                <td style={styles.td} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem",
  },
  header: {
    display: "flex",
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  title: { margin: 0, color: "#2c3e50" },
  primaryButton: {
    background: "#4a90e2",
    color: "white",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
  },
  formCard: {
    background: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "1.5rem",
  },
  formTitle: { margin: "0 0 1rem 0", color: "#2c3e50" },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "1rem",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.4rem",
  },
  input: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "1rem",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "1rem",
    marginTop: "1.5rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e0e0e0",
  },
  cancelButton: {
    background: "#f0f0f0",
    color: "#333",
    border: "1px solid #ddd",
    padding: "0.75rem 1.5rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  submitButton: {
    background: "#4a90e2",
    color: "white",
    border: "none",
    padding: "0.75rem 1.5rem",
    borderRadius: "6px",
    cursor: "pointer",
  },
  empty: {
    textAlign: "center" as const,
    padding: "3rem",
    color: "#888",
    background: "#fafafa",
    borderRadius: "8px",
    border: "1px dashed #ddd",
  },
  tableWrapper: { overflowX: "auto" as const },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.9rem",
  },
  th: {
    background: "#f0f0f0",
    padding: "0.75rem 1rem",
    textAlign: "left" as const,
    borderBottom: "2px solid #ddd",
    whiteSpace: "nowrap" as const,
    color: "#444",
  },
  td: {
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #eee",
    verticalAlign: "middle" as const,
  },
  totalRow: { background: "#f0f7ff" },
  categoryBadge: {
    background: "#e8f4f8",
    color: "#2980b9",
    padding: "0.2rem 0.6rem",
    borderRadius: "12px",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  rowActions: { display: "flex", gap: "0.5rem" },
  editButton: {
    background: "#f0f0f0",
    color: "#333",
    border: "1px solid #ddd",
    padding: "0.4rem 0.8rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  deleteButton: {
    background: "#fee",
    color: "#c0392b",
    border: "1px solid #fcc",
    padding: "0.4rem 0.8rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  error: { color: "#e74c3c", fontSize: "0.875rem" },
};
