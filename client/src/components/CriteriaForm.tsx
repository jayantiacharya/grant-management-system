import { useState } from "react";
import { type Criteria, type RatingSuggestion } from "../types/rubric";
import "../styles/CriteriaForm.css";

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
    <form onSubmit={handleSubmit} className="criteria-form">
      <h2>{initialData ? "Edit Criteria" : "Add New Criteria"}</h2>

      <div className="criteria-form-group">
        <label htmlFor="name">Criteria Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Educational Impact"
          className="criteria-form-input"
        />
        {errors.name && (
          <span className="criteria-form-error">{errors.name}</span>
        )}
      </div>

      <div className="criteria-form-group">
        <label htmlFor="description">Description / Question *</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          placeholder="e.g., How does the proposed project enhance educational experience?"
          className="criteria-form-textarea"
        />
        {errors.description && (
          <span className="criteria-form-error">{errors.description}</span>
        )}
      </div>

      <div className="criteria-form-group">
        <label htmlFor="maxScore">Maximum Score *</label>
        <input
          type="number"
          id="maxScore"
          name="maxScore"
          value={formData.maxScore}
          onChange={handleChange}
          min="1"
          step="1"
          className="criteria-form-input"
        />
        {errors.maxScore && (
          <span className="criteria-form-error">{errors.maxScore}</span>
        )}
      </div>

      <div className="criteria-form-group">
        <label>Rating Suggestions</label>
        <p className="criteria-form-hint">
          Define the score options reviewers can select from. Each score must
          not exceed the maximum score.
        </p>
        <div className="criteria-form-suggestions-list">
          {formData.ratingSuggestions.map((suggestion, idx) => (
            <div key={idx} className="criteria-form-suggestion-item">
              <div className="criteria-form-suggestion-score">
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
                  className="criteria-form-input"
                />
                {errors[`suggestion_${idx}_score`] && (
                  <span className="criteria-form-error">
                    {errors[`suggestion_${idx}_score`]}
                  </span>
                )}
              </div>
              <div className="criteria-form-suggestion-description">
                <label>Description</label>
                <input
                  type="text"
                  value={suggestion.description}
                  onChange={(e) =>
                    handleSuggestionChange(idx, "description", e.target.value)
                  }
                  placeholder="e.g., Impacts a large number of students"
                  className="criteria-form-input"
                />
                {errors[`suggestion_${idx}_desc`] && (
                  <span className="criteria-form-error">
                    {errors[`suggestion_${idx}_desc`]}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeSuggestion(idx)}
                disabled={formData.ratingSuggestions.length === 1}
                className="criteria-form-remove-button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSuggestion}
          className="criteria-form-add-button"
        >
          + Add Rating Suggestion
        </button>
      </div>

      <div className="criteria-form-actions">
        <button
          type="button"
          onClick={onCancel}
          className="criteria-form-cancel-button"
        >
          Cancel
        </button>
        <button type="submit" className="criteria-form-submit-button">
          {initialData ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
