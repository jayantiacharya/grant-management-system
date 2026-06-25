import "./AllocationPage.css";

type GrantAllocation = {
  id: number;
  grantTitle: string;
  submittedBy: string;
  principalInvestigator: string;
  arccAmountRequested: number;
  otherSourcesAmount: number;
  reviewerScores: number[];
  status: string;
};

const currentCycleAmount = 50000;
const cutoffPercentage = 75;

const grants: GrantAllocation[] = [
  {
    id: 1,
    grantTitle: "STEM Lab Equipment",
    submittedBy: "John Smith",
    principalInvestigator: "Dr. Emily Carter",
    arccAmountRequested: 8000,
    otherSourcesAmount: 2500,
    reviewerScores: [88, 90, 84, 92, 86],
    status: "Eligible",
  },
  {
    id: 2,
    grantTitle: "Student Research Support",
    submittedBy: "Sarah Johnson",
    principalInvestigator: "Dr. Michael Brown",
    arccAmountRequested: 5000,
    otherSourcesAmount: 1500,
    reviewerScores: [72, 75, 70, 74, 69],
    status: "Below Cutoff",
  },
];

export default function AllocationPage() {
  const totalArccRequested = grants.reduce(
    (total, grant) => total + grant.arccAmountRequested,
    0,
  );

  const leftoverAmount = currentCycleAmount - totalArccRequested;

  const getAggregateFinalRating = (scores: number[]) => {
    if (scores.length === 0) return 0;

    const totalScore = scores.reduce((total, score) => total + score, 0);
    return totalScore / scores.length;
  };

  const handleSendToAccounting = () => {
    alert(
      "Accounting spreadsheet export will be connected later when backend/export logic is ready.",
    );
  };

  return (
    <div className="allocation-page">
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
          <div className="summary-box">
            <span>Current Cycle Amount</span>
            <strong>${currentCycleAmount.toLocaleString()}</strong>
          </div>

          <div className="summary-box">
            <span>Leftover Amount</span>
            <strong>${leftoverAmount.toLocaleString()}</strong>
          </div>

          <div className="summary-box">
            <span>Cutoff Percentage</span>
            <strong>{cutoffPercentage}%</strong>
          </div>
        </div>

        <table className="allocation-table">
          <thead>
            <tr>
              <th>Grant Title</th>
              <th>Submitted By</th>
              <th>Principal Investigator</th>
              <th>ARCC Amount Requested</th>
              <th>Other Sources</th>
              <th>Aggregate Final Rating</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {grants.map((grant) => {
              const aggregateFinalRating = getAggregateFinalRating(
                grant.reviewerScores,
              );

              return (
                <tr key={grant.id}>
                  <td>{grant.grantTitle}</td>
                  <td>{grant.submittedBy}</td>
                  <td>{grant.principalInvestigator}</td>
                  <td>${grant.arccAmountRequested.toLocaleString()}</td>
                  <td>${grant.otherSourcesAmount.toLocaleString()}</td>
                  <td>{aggregateFinalRating.toFixed(1)}%</td>
                  <td>{grant.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="allocation-actions">
          <button
            className="send-accounting-btn"
            onClick={handleSendToAccounting}
          >
            Send to Accounting
          </button>

          <p className="export-note">
            Spreadsheet/export functionality will be connected later.
          </p>
        </div>
      </div>
    </div>
  );
}
