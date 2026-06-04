import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGrant } from "../context/GrantContext";
import "./Dashboard.css";

type BudgetItem = {
  itemDescription: string;
  category: string;
  amountRequested: string;
  amountFromARCC: string;
  amountFromCollege: string;
  amountFromDepartment: string;
  amountFromOtherSources: string;
};

const emptyBudgetItem: BudgetItem = {
  itemDescription: "",
  category: "",
  amountRequested: "",
  amountFromARCC: "",
  amountFromCollege: "",
  amountFromDepartment: "",
  amountFromOtherSources: "",
};

export default function BudgetWorksheet() {
  const { user, logout } = useAuth();
  const { budgetItems, setBudgetItems } = useGrant();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
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
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>

        <div className="dash-user">
          <span>{user?.email}</span>

          <button
            onClick={() => navigate("/grants/new")}
            className="logout-btn"
          >
            Back to Grant Form
          </button>

          <button onClick={handleLogout} className="logout-btn">
            Sign out
          </button>
        </div>
      </header>

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
