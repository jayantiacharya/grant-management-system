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

  // -------------------------
  // Helpers
  // -------------------------

  const getAggregateFinalRating = (scores: number[]) => {
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const getAllocationPercent = (rating: number) => {
    const rule = rules.find(
      (r) => rating >= Number(r.minRating) && rating <= Number(r.maxRating),
    );

    return rule ? Number(rule.allocationPercent) : 0;
  };

  const getAllocatedAmount = (grant: GrantAllocation) => {
    const rating = getAggregateFinalRating(grant.reviewerScores);

    if (rating < Number(cutoffPercentage)) return 0;

    if (rating >= 90) return grant.arccAmountRequested;

    const percent = getAllocationPercent(rating);
    return (grant.arccAmountRequested * percent) / 100;
  };

  //SINGLE SOURCE OF TRUTH
  const getStatus = (rating: number, allocatedAmount: number) => {
    if (rating < Number(cutoffPercentage)) return "Rejected";
    if (rating >= 90) return "Approved (Full)";
    if (allocatedAmount > 0) return "Approved (Partial)";
    return "Pending";
  };

  const formatMoney = (amount: number | string) =>
    Number(amount).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  const eligibleGrants = initialGrants.filter(
    (g) =>
      getAggregateFinalRating(g.reviewerScores) >= Number(cutoffPercentage),
  );

  const rejectedGrants = initialGrants.filter(
    (g) => getAggregateFinalRating(g.reviewerScores) < Number(cutoffPercentage),
  );

  // -------------------------
  // Rules
  // -------------------------

  const handleRuleChange = (
    id: number,
    field: keyof Omit<AllocationRule, "id">,
    value: string,
  ) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: Date.now(),
        minRating: "",
        maxRating: "",
        allocationPercent: "",
      },
    ]);
  };

  const handleRemoveRule = (id: number) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  // -------------------------
  // CSV EXPORT
  // -------------------------

  const handleSendToAccounting = () => {
    const headers = [
      "Grant Title",
      "Principal Investigator",
      "Amount Requested",
      "Allocated Amount",
      "Final Rating",
      "Status",
    ];

    const rows = initialGrants.map((grant) => {
      const rating = getAggregateFinalRating(grant.reviewerScores);
      const allocatedAmount = getAllocatedAmount(grant);
      const status = getStatus(rating, allocatedAmount);

      return [
        grant.grantTitle,
        grant.principalInvestigator,
        grant.arccAmountRequested.toString(),
        allocatedAmount.toString(),
        rating.toFixed(1),
        status,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "accounting_export.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // -------------------------
  // Render Table Rows
  // -------------------------

  const renderGrantRows = (grants: GrantAllocation[]) =>
    grants.map((grant) => {
      const rating = getAggregateFinalRating(grant.reviewerScores);
      const allocatedAmount = getAllocatedAmount(grant);
      const status = getStatus(rating, allocatedAmount);

      return (
        <tr key={grant.id}>
          <td>{grant.grantTitle}</td>
          <td>{grant.submittedBy}</td>
          <td>{grant.principalInvestigator}</td>
          <td>{formatMoney(grant.arccAmountRequested)}</td>
          <td>{formatMoney(grant.otherSourcesAmount)}</td>
          <td>{rating.toFixed(1)}%</td>
          <td>{formatMoney(allocatedAmount)}</td>
          <td>
            <span
              className={
                status === "Rejected"
                  ? "status-badge rejected"
                  : status === "Approved (Full)"
                    ? "status-badge approved"
                    : status === "Approved (Partial)"
                      ? "status-badge partial"
                      : "status-badge pending"
              }
            >
              {status}
            </span>
          </td>
        </tr>
      );
    });

  // -------------------------
  // UI
  // -------------------------

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "← Back to Admin Dashboard", to: "/admin" }} />

      <main className="allocation-page">
        <div className="allocation-card">
          <h1>Allocation Page</h1>

          <div className="allocation-summary">
            <label className="summary-box">
              <span>Current Cycle Amount</span>

              <input
                type="number"
                value={currentCycleAmount}
                onChange={(e) => setCurrentCycleAmount(e.target.value)}
                disabled={allocationFinalized}
              />
            </label>

            <label className="summary-box">
              <span>Leftover Amount</span>

              <input
                type="number"
                value={leftoverAmount}
                onChange={(e) => setLeftoverAmount(e.target.value)}
                disabled={allocationFinalized}
              />
            </label>

            <label className="summary-box">
              <span>Cutoff Percentage</span>

              <input
                type="number"
                value={cutoffPercentage}
                onChange={(e) => setCutoffPercentage(e.target.value)}
                disabled={allocationFinalized}
              />
            </label>
          </div>

          {/* Eligible */}
          <section>
            <h2>Approved Grants</h2>

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

          {/* Rejected */}
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

              <tbody>{renderGrantRows(rejectedGrants)}</tbody>
            </table>
          </section>

          {/* Actions */}
          <div className="allocation-actions">
            <button onClick={handleSendToAccounting}>Send to Accounting</button>

            <button
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
