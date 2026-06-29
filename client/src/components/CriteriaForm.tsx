import { useState } from "react";
import { type Criteria, type RatingSuggestion } from "../types/rubric";

interface CriteriaFormProps {
  initialData?: Criteria;
  onSubmit: (data: Partial<Criteria>) => void;
  onCancel: () => void;
}

export default function CriteriaForm({
  initialData,
  onSubmit,
  onCancel,
}: CriteriaFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    maxScore: initialData?.maxScore || 0,
    ratingSuggestions: initialData?.ratingSuggestions || [
      { score: 0, description: "" },
    ],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "maxScore" ? parseInt(value) || 0 : value,
    }));
  };

  const handleSuggestionChange = (
    index: number,
    field: keyof RatingSuggestion,
    value: string | number,
  ) => {
    const updatedSuggestions = [...formData.ratingSuggestions];
    updatedSuggestions[index] = {
      ...updatedSuggestions[index],
      [field]: field === "score" ? parseInt(value as string) || 0 : value,
    };
    setFormData((prev) => ({ ...prev, ratingSuggestions: updatedSuggestions }));
  };

  const addSuggestion = () => {
    setFormData((prev) => ({
      ...prev,
      ratingSuggestions: [
        ...prev.ratingSuggestions,
        { score: 0, description: "" },
      ],
    }));
  };

  const removeSuggestion = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ratingSuggestions: prev.ratingSuggestions.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (formData.maxScore <= 0)
      newErrors.maxScore = "Max score must be greater than 0";

    // Each score is an independent option — check individually, not as a sum
    formData.ratingSuggestions.forEach((suggestion, idx) => {
      if (suggestion.score > formData.maxScore) {
        newErrors[`suggestion_${idx}_score`] =
          `Score cannot exceed max score (${formData.maxScore})`;
      }
      if (suggestion.score < 0) {
        newErrors[`suggestion_${idx}_score`] = "Score cannot be negative";
      }
      if (!suggestion.description.trim()) {
        newErrors[`suggestion_${idx}_desc`] = "Description is required";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2>{initialData ? "Edit Criteria" : "Add New Criteria"}</h2>

      <div style={styles.formGroup}>
        <label htmlFor="name">Criteria Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Educational Impact"
          style={styles.input}
        />
        {errors.name && <span style={styles.error}>{errors.name}</span>}
      </div>

      <div style={styles.formGroup}>
        <label htmlFor="description">Description / Question *</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          placeholder="e.g., How does the proposed project enhance educational experience?"
          style={styles.textarea}
        />
        {errors.description && (
          <span style={styles.error}>{errors.description}</span>
        )}
      </div>

      <div style={styles.formGroup}>
        <label htmlFor="maxScore">Maximum Score *</label>
        <input
          type="number"
          id="maxScore"
          name="maxScore"
          value={formData.maxScore}
          onChange={handleChange}
          min="1"
          step="1"
          style={styles.input}
        />
        {errors.maxScore && <span style={styles.error}>{errors.maxScore}</span>}
      </div>

      <div style={styles.formGroup}>
        <label>Rating Suggestions</label>
        <p style={styles.hint}>
          Define the score options reviewers can select from. Each score must
          not exceed the maximum score.
        </p>
        <div style={styles.suggestionsList}>
          {formData.ratingSuggestions.map((suggestion, idx) => (
            <div key={idx} style={styles.suggestionItem}>
              <div style={styles.suggestionScore}>
                <label>Score</label>
                <input
                  type="number"
                  value={suggestion.score}
                  onChange={(e) =>
                    handleSuggestionChange(idx, "score", e.target.value)
                  }
                  min="0"
                  max={formData.maxScore}
                  step="1"
                  style={styles.input}
                />
                {errors[`suggestion_${idx}_score`] && (
                  <span style={styles.error}>
                    {errors[`suggestion_${idx}_score`]}
                  </span>
                )}
              </div>
              <div style={styles.suggestionDescription}>
                <label>Description</label>
                <input
                  type="text"
                  value={suggestion.description}
                  onChange={(e) =>
                    handleSuggestionChange(idx, "description", e.target.value)
                  }
                  placeholder="e.g., Impacts a large number of students"
                  style={styles.input}
                />
                {errors[`suggestion_${idx}_desc`] && (
                  <span style={styles.error}>
                    {errors[`suggestion_${idx}_desc`]}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeSuggestion(idx)}
                disabled={formData.ratingSuggestions.length === 1}
                style={styles.removeButton}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addSuggestion} style={styles.addButton}>
          + Add Rating Suggestion
        </button>
      </div>

      <div style={styles.formActions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>
          Cancel
        </button>
        <button type="submit" style={styles.submitButton}>
          {initialData ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}

const styles = {
  form: { display: "flex", flexDirection: "column" as const, gap: "1.5rem" },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
  },
  hint: { fontSize: "0.85rem", color: "#777", margin: "0" },
  input: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "1rem",
  },
  textarea: {
    padding: "0.75rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "1rem",
    fontFamily: "inherit",
  },
  suggestionsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
    marginBottom: "1rem",
  },
  suggestionItem: {
    display: "flex",
    gap: "1rem",
    alignItems: "flex-start",
    padding: "1rem",
    background: "#f9f9f9",
    borderRadius: "6px",
  },
  suggestionScore: { flex: "0 0 120px" },
  suggestionDescription: { flex: 1 },
  removeButton: {
    background: "#fee",
    color: "#c0392b",
    border: "1px solid #fcc",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "1.5rem",
  },
  addButton: {
    background: "#e8f4f8",
    color: "#2980b9",
    border: "1px solid #bde0f0",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
    width: "fit-content",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "1rem",
    marginTop: "1rem",
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
  error: { color: "#e74c3c", fontSize: "0.875rem" },
};
