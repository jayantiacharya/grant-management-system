import { useState } from "react";
import DashHeader from "../components/DashHeader";
import "./AllocationPage.css";

type GrantAllocation = {
  id: number;
  grantTitle: string;
  submittedBy: string;
  principalInvestigator: string;
  arccAmountRequested: number;
  otherSourcesAmount: number;
  reviewerScores: number[];
};

type AllocationRule = {
  id: number;
  minRating: string;
  maxRating: string;
  allocationPercent: string;
};

const initialGrants: GrantAllocation[] = [
  {
    id: 1,
    grantTitle: "STEM Lab Equipment",
    submittedBy: "John Smith",
    principalInvestigator: "Dr. Emily Carter",
    arccAmountRequested: 8000,
    otherSourcesAmount: 2500,
    reviewerScores: [88, 90, 84, 92, 86],
  },
  {
    id: 2,
    grantTitle: "Student Research Support",
    submittedBy: "Sarah Johnson",
    principalInvestigator: "Dr. Michael Brown",
    arccAmountRequested: 5000,
    otherSourcesAmount: 1500,
    reviewerScores: [72, 75, 70, 74, 69],
  },
];

export default function AllocationPage() {
  const [currentCycleAmount, setCurrentCycleAmount] = useState("50000");
  const [leftoverAmount, setLeftoverAmount] = useState("37000");
  const [cutoffPercentage, setCutoffPercentage] = useState("75");
  const [allocationFinalized, setAllocationFinalized] = useState(false);

  const [rules, setRules] = useState<AllocationRule[]>([
    { id: 1, minRating: "90", maxRating: "100", allocationPercent: "100" },
    { id: 2, minRating: "80", maxRating: "89.99", allocationPercent: "75" },
    { id: 3, minRating: "75", maxRating: "79.99", allocationPercent: "50" },
  ]);

  const getAggregateFinalRating = (scores: number[]) => {
    if (scores.length === 0) return 0;
    return scores.reduce((total, score) => total + score, 0) / scores.length;
  };

  const getAllocationPercent = (rating: number) => {
    const rule = rules.find(
      (rule) =>
        rating >= Number(rule.minRating) && rating <= Number(rule.maxRating),
    );

    return rule ? Number(rule.allocationPercent) : 0;
  };

  const getAllocatedAmount = (grant: GrantAllocation) => {
    const rating = getAggregateFinalRating(grant.reviewerScores);

    if (rating < Number(cutoffPercentage)) return 0;

    const allocationPercent = getAllocationPercent(rating);
    return (grant.arccAmountRequested * allocationPercent) / 100;
  };

  const eligibleGrants = initialGrants.filter(
    (grant) =>
      getAggregateFinalRating(grant.reviewerScores) >= Number(cutoffPercentage),
  );

  const rejectedGrants = initialGrants.filter(
    (grant) =>
      getAggregateFinalRating(grant.reviewerScores) < Number(cutoffPercentage),
  );

  const handleRuleChange = (
    id: number,
    field: keyof Omit<AllocationRule, "id">,
    value: string,
  ) => {
    setRules((currentRules) =>
      currentRules.map((rule) =>
        rule.id === id ? { ...rule, [field]: value } : rule,
      ),
    );
  };

  const handleAddRule = () => {
    setRules((currentRules) => [
      ...currentRules,
      {
        id: Date.now(),
        minRating: "",
        maxRating: "",
        allocationPercent: "",
      },
    ]);
  };

  const handleRemoveRule = (id: number) => {
    setRules((currentRules) => currentRules.filter((rule) => rule.id !== id));
  };

  const handleSendToAccounting = () => {
    alert("Export will connect to backend once accounting endpoint is ready.");
  };

  const renderGrantRows = (grants: GrantAllocation[], rejected = false) =>
    grants.map((grant) => {
      const aggregateFinalRating = getAggregateFinalRating(
        grant.reviewerScores,
      );
      const allocatedAmount = getAllocatedAmount(grant);

      return (
        <tr key={grant.id}>
          <td>{grant.grantTitle}</td>
          <td>{grant.submittedBy}</td>
          <td>{grant.principalInvestigator}</td>
          <td>${grant.arccAmountRequested.toLocaleString()}</td>
          <td>${grant.otherSourcesAmount.toLocaleString()}</td>
          <td>{aggregateFinalRating.toFixed(1)}%</td>
          <td>${allocatedAmount.toLocaleString()}</td>
          <td>
            {rejected
              ? "Rejected"
              : allocatedAmount > 0
                ? "Accepted"
                : "Pending"}
          </td>
        </tr>
      );
    });

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "← Back to Admin Dashboard", to: "/admin" }} />

      <main className="allocation-page">
        <div className="allocation-card">
          <div className="allocation-header">
            <div>
              <h1>Allocation Page</h1>
              <p className="allocation-subtitle">
                ARCC committee chair allocation overview and final funding list.
              </p>
            </div>

            <span className="chair-only-badge">ARCC Committee Chair Only</span>
          </div>

          <div className="allocation-summary">
            <label className="summary-box">
              <span>Current Cycle Amount</span>
              <input
                type="number"
                value={currentCycleAmount}
                disabled={allocationFinalized}
                onChange={(e) => setCurrentCycleAmount(e.target.value)}
              />
            </label>

            <label className="summary-box">
              <span>Leftover Amount</span>
              <input
                type="number"
                value={leftoverAmount}
                disabled={allocationFinalized}
                onChange={(e) => setLeftoverAmount(e.target.value)}
              />
            </label>

            <label className="summary-box">
              <span>Cutoff Percentage</span>
              <input
                type="number"
                value={cutoffPercentage}
                disabled={allocationFinalized}
                onChange={(e) => setCutoffPercentage(e.target.value)}
              />
            </label>
          </div>

          <section className="criteria-card">
            <div className="section-header">
              <h2>Allocation Criteria</h2>
              <button disabled={allocationFinalized} onClick={handleAddRule}>
                Add Criteria
              </button>
            </div>

            {rules.map((rule) => (
              <div className="criteria-row" key={rule.id}>
                <input
                  type="number"
                  value={rule.minRating}
                  disabled={allocationFinalized}
                  onChange={(e) =>
                    handleRuleChange(rule.id, "minRating", e.target.value)
                  }
                  placeholder="Min Rating"
                />

                <input
                  type="number"
                  value={rule.maxRating}
                  disabled={allocationFinalized}
                  onChange={(e) =>
                    handleRuleChange(rule.id, "maxRating", e.target.value)
                  }
                  placeholder="Max Rating"
                />

                <input
                  type="number"
                  value={rule.allocationPercent}
                  disabled={allocationFinalized}
                  onChange={(e) =>
                    handleRuleChange(
                      rule.id,
                      "allocationPercent",
                      e.target.value,
                    )
                  }
                  placeholder="Allocation %"
                />

                <button
                  disabled={allocationFinalized}
                  onClick={() => handleRemoveRule(rule.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          <section>
            <h2>Eligible / Approved Grants</h2>

            <table className="allocation-table">
              <thead>
                <tr>
                  <th>Grant Title</th>
                  <th>Submitted By</th>
                  <th>Principal Investigator</th>
                  <th>ARCC Requested</th>
                  <th>Other Sources</th>
                  <th>Final Rating</th>
                  <th>Allocated Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>{renderGrantRows(eligibleGrants)}</tbody>
            </table>
          </section>

          <section className="table-section">
            <h2>Rejected Grants</h2>

            <table className="allocation-table">
              <thead>
                <tr>
                  <th>Grant Title</th>
                  <th>Submitted By</th>
                  <th>Principal Investigator</th>
                  <th>ARCC Requested</th>
                  <th>Other Sources</th>
                  <th>Final Rating</th>
                  <th>Allocated Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>{renderGrantRows(rejectedGrants, true)}</tbody>
            </table>
          </section>

          <div className="allocation-actions">
            <button onClick={handleSendToAccounting}>Send to Accounting</button>

            <button
              className="finish-btn"
              disabled={allocationFinalized}
              onClick={() => setAllocationFinalized(true)}
            >
              {allocationFinalized
                ? "Allocation Finalized"
                : "Finish Allocation"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
