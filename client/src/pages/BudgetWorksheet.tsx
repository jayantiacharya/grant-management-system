import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import {
  useGrant,
  emptyBudgetItem,
  type BudgetItem,
} from "../context/GrantContext";
import DashHeader from "../components/DashHeader";
import "./Dashboard.css";

export default function BudgetWorksheet() {
  const { budgetItems, setBudgetItems } = useGrant();
  const location = useLocation();
  const returnTo = location.state?.returnTo ?? "/grants/new";

  const [colleges, setColleges] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/admin/colleges")
      .then(({ data }) => setColleges(data))
      .catch((err) => console.error("Failed to load colleges:", err));
  }, []);

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

    // If amountFromCollege is cleared, also clear the collegeId
    if (field === "amountFromCollege" && (!value || parseFloat(value) === 0)) {
      updatedItems[index].collegeId = "";
    }

    const item = updatedItems[index];

    const amountRequested =
      Number(item.amountFromARCC || 0) +
      Number(item.amountFromCollege || 0) +
      Number(item.amountFromDepartment || 0) +
      Number(item.amountFromOtherSources || 0);

    updatedItems[index].amountRequested = amountRequested.toFixed(2);

    setBudgetItems(updatedItems);
  };

  const addBudgetItem = () => {
    setBudgetItems([...budgetItems, { ...emptyBudgetItem }]);
  };

  const removeBudgetItem = (index: number) => {
    if (budgetItems.length === 1) return;
    setBudgetItems(budgetItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const getFundingSourceTotal = () => {
    return budgetItems.reduce((total, item) => {
      return (
        total +
        Number(item.amountFromARCC || 0) +
        Number(item.amountFromCollege || 0) +
        Number(item.amountFromDepartment || 0) +
        Number(item.amountFromOtherSources || 0)
      );
    }, 0);
  };

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "Back to Grant Form", to: returnTo }} />

      <main className="dash-main">
        <div className="grant-form-card">
          <h2 className="grant-title">Budget Worksheet</h2>

          <p className="grant-description">
            Add budget items and funding sources for the grant proposal.
          </p>

          <div className="budget-section">
            {budgetItems.map((item, index) => (
              <div key={index} className="budget-item-card">
                <h3>Budget Item {index + 1}</h3>

                <div className="budget-field">
                  <label htmlFor={`budgetItemName-${index}`}>
                    Budget Item Name
                  </label>
                  <input
                    type="text"
                    id={`budgetItemName-${index}`}
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

                <div className="budget-field">
                  <label htmlFor={`category-${index}`}>Category</label>
                  <input
                    type="text"
                    id={`category-${index}`}
                    value={item.category}
                    onChange={(e) =>
                      handleBudgetItemChange(index, "category", e.target.value)
                    }
                    placeholder="Example: Hardware or Software"
                  />
                </div>

                <div className="budget-grid">
                  <div className="budget-field">
                    <label htmlFor={`amountRequested-${index}`}>
                      Total Amount Requested
                    </label>
                    {/* Auto-computed from the funding source fields below. */}
                    <input
                      type="number"
                      id={`amountRequested-${index}`}
                      value={item.amountRequested}
                      readOnly
                      placeholder="0.00"
                    />
                  </div>

                  <div className="budget-field">
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

                  <div className="budget-field">
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

                  {/* Show college picker only when an amount is entered */}
                  {parseFloat(item.amountFromCollege) > 0 && (
                    <div className="budget-field">
                      <label htmlFor={`collegeId-${index}`}>
                        Which College? <span style={{ color: "red" }}>*</span>
                      </label>
                      <select
                        id={`collegeId-${index}`}
                        value={item.collegeId}
                        onChange={(e) =>
                          handleBudgetItemChange(
                            index,
                            "collegeId",
                            e.target.value,
                          )
                        }
                        required
                        style={{
                          borderColor:
                            parseFloat(item.amountFromCollege) > 0 &&
                            !item.collegeId
                              ? "red"
                              : undefined,
                        }}
                      >
                        <option value="">Select a college</option>
                        {colleges.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {parseFloat(item.amountFromCollege) > 0 &&
                        !item.collegeId && (
                          <span style={{ color: "red", fontSize: "0.85rem" }}>
                            Please select a college for this funding amount.
                          </span>
                        )}
                    </div>
                  )}

                  <div className="budget-field">
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

                  <div className="budget-field">
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

            <div className="budget-actions">
              <button
                type="button"
                className="submit-btn"
                onClick={addBudgetItem}
              >
                Add Budget Item
              </button>

              <p className="budget-total">
                Total Requested: ${getFundingSourceTotal().toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
