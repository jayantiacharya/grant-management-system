import { useEffect, useState } from "react";
import axios from "axios";
import DashHeader from "../components/DashHeader";
import { useAuth } from "../context/AuthContext";
import "./AllocationPage.css";

type GrantAllocation = {
  id: string | number;
  grantTitle: string;
  submittedBy: string;
  principalInvestigator: string;
  arccAmountRequested: number;
  otherSourcesAmount: number;
  finalRating: number;
  allocatedAmount: number;
  status: string;
};

type ApiGrant = {
  id?: string | number;
  _id?: string;
  grantTitle?: string;
  title?: string;
  submittedBy?: string;
  proposerName?: string;
  principalInvestigator?: string;
  projectDirector?: string;
  arccAmountRequested?: number;
  amountRequested?: number;
  otherSourcesAmount?: number;
  otherSources?: number;
  finalRating?: number;
  finalRatingPercentage?: number;
  allocatedAmount?: number;
  status?: string;
};

export default function AllocationPage() {
  const { token } = useAuth();

  const [currentCycleAmount, setCurrentCycleAmount] = useState("50000");
  const [leftoverAmount, setLeftoverAmount] = useState("37000");
  const [cutoffPercentage, setCutoffPercentage] = useState("75");
  const [allocationFinalized, setAllocationFinalized] = useState(false);

  const [grants, setGrants] = useState<GrantAllocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const formatMoney = (amount: number | string) =>
    Number(amount || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  const normalizeGrant = (grant: ApiGrant): GrantAllocation => {
    const finalRating = Number(
      grant.finalRatingPercentage ?? grant.finalRating ?? 0,
    );

    const arccAmountRequested = Number(
      grant.arccAmountRequested ?? grant.amountRequested ?? 0,
    );

    const otherSourcesAmount = Number(
      grant.otherSourcesAmount ?? grant.otherSources ?? 0,
    );

    const allocatedAmount = Number(grant.allocatedAmount ?? 0);

    return {
      id: grant.id ?? grant._id ?? crypto.randomUUID(),
      grantTitle: grant.grantTitle ?? grant.title ?? "Untitled Grant",
      submittedBy: grant.submittedBy ?? grant.proposerName ?? "Not listed",
      principalInvestigator:
        grant.principalInvestigator ?? grant.projectDirector ?? "Not listed",
      arccAmountRequested,
      otherSourcesAmount,
      finalRating,
      allocatedAmount,
      status:
        grant.status ??
        (finalRating < Number(cutoffPercentage)
          ? "Rejected"
          : allocatedAmount >= arccAmountRequested
            ? "Approved (Full)"
            : allocatedAmount > 0
              ? "Approved (Partial)"
              : "Pending"),
    };
  };

  const fetchAllocationGrants = async () => {
    if (!token) return;

    setLoading(true);
    setMessage("");

    try {
      const { data } = await axios.get(
        "http://localhost:5000/api/allocation/grants",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const apiGrants = Array.isArray(data) ? data : data.grants;

      setGrants(Array.isArray(apiGrants) ? apiGrants.map(normalizeGrant) : []);

      if (data.currentCycleAmount !== undefined) {
        setCurrentCycleAmount(String(data.currentCycleAmount));
      }

      if (data.leftoverAmount !== undefined) {
        setLeftoverAmount(String(data.leftoverAmount));
      }

      if (data.cutoffPercentage !== undefined) {
        setCutoffPercentage(String(data.cutoffPercentage));
      }
    } catch (error) {
      console.error("Failed to load allocation grants:", error);
      setMessage("Failed to load allocation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocationGrants();
  }, [token]);

  const approvedGrants = grants.filter(
    (grant) => grant.finalRating >= Number(cutoffPercentage),
  );

  const rejectedGrants = grants.filter(
    (grant) => grant.finalRating < Number(cutoffPercentage),
  );

  const handleSendToAccounting = async () => {
    if (!token) return;

    try {
      await axios.post(
        "http://localhost:5000/api/allocation/send-to-accounting",
        {
          currentCycleAmount: Number(currentCycleAmount),
          leftoverAmount: Number(leftoverAmount),
          cutoffPercentage: Number(cutoffPercentage),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      alert("Allocation data sent to accounting successfully.");
    } catch (error) {
      console.error("Failed to send allocation data to accounting:", error);
      alert("Failed to send allocation data to accounting.");
    }
  };

  const getStatusClass = (status: string) => {
    if (status.toLowerCase().includes("rejected"))
      return "status-badge rejected";
    if (status.toLowerCase().includes("full")) return "status-badge approved";
    if (status.toLowerCase().includes("partial")) return "status-badge partial";
    return "status-badge pending";
  };

  const renderGrantRows = (grantRows: GrantAllocation[]) => {
    if (grantRows.length === 0) {
      return (
        <tr>
          <td colSpan={8}>No grants found.</td>
        </tr>
      );
    }

    return grantRows.map((grant) => (
      <tr key={grant.id}>
        <td>{grant.grantTitle}</td>
        <td>{grant.submittedBy}</td>
        <td>{grant.principalInvestigator}</td>
        <td>{formatMoney(grant.arccAmountRequested)}</td>
        <td>{formatMoney(grant.otherSourcesAmount)}</td>
        <td>{grant.finalRating.toFixed(1)}%</td>
        <td>{formatMoney(grant.allocatedAmount)}</td>
        <td>
          <span className={getStatusClass(grant.status)}>{grant.status}</span>
        </td>
      </tr>
    ));
  };

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "← Back to Admin Dashboard", to: "/admin" }} />

      <main className="allocation-page">
        <div className="allocation-card">
          <h1>Allocation Page</h1>

          {message && <p className="form-message">{message}</p>}
          {loading && (
            <p className="form-message">Loading allocation data...</p>
          )}

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

              <tbody>{renderGrantRows(approvedGrants)}</tbody>
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

              <tbody>{renderGrantRows(rejectedGrants)}</tbody>
            </table>
          </section>

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
