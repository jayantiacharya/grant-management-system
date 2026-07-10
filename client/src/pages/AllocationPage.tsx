import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import DashHeader from "../components/DashHeader";
import { useAuth } from "../context/AuthContext";
import "../styles/PageLayout.css";
import "../styles/AllocationPage.css";
import "../styles/GrantForm.css";

type AllocationCriterion = {
  fromPercentage: string;
  toPercentage: string;
  awardPercentage: string;
};

type GrantAllocation = {
  id: string | number;
  grantTitle: string;
  submittedBy: string;
  principalInvestigator: string;
  accountNumber: string;
  arccAmountRequested: number;
  otherSourcesAmount: number;
  finalPercent: number;
  allocatedAmount: number;
  status: string;
  reviewCount: number;
};

type ApiGrant = {
  id?: string | number;
  _id?: string;
  grantTitle?: string;
  title?: string;
  submittedBy?: string;
  submittedEmail?: string;
  proposerName?: string;
  principalInvestigator?: string;
  projectDirector?: string;
  projectDirectorId?: string;
  accountNumber?: string;
  arccAmountRequested?: number;
  amountRequested?: number;
  amountFromARCC?: number;
  otherSourcesAmount?: number;
  otherSources?: number;
  amountFromOtherSources?: number;
  finalPercent?: number;
  finalRating?: number;
  finalRatingPercentage?: number;
  allocatedAmount?: number;
  status?: string;
  reviewCount?: number;
};

const DEFAULT_CRITERIA: AllocationCriterion[] = [
  { fromPercentage: "90", toPercentage: "100", awardPercentage: "100" },
  { fromPercentage: "80", toPercentage: "89.99", awardPercentage: "75" },
  { fromPercentage: "75", toPercentage: "79.99", awardPercentage: "50" },
];

export default function AllocationPage() {
  const { token } = useAuth();

  const [currentCycleAmount, setCurrentCycleAmount] = useState("50000");
  const [cutoffPercentage, setCutoffPercentage] = useState("75");
  const [allocationFinalized, setAllocationFinalized] = useState(false);

  const [criteria, setCriteria] =
    useState<AllocationCriterion[]>(DEFAULT_CRITERIA);
  const [baseGrants, setBaseGrants] = useState<GrantAllocation[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const formatMoney = (amount: number | string) =>
    Number(amount || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  const authHeader = {
    headers: { Authorization: `Bearer ${token}` },
  };

  const normalizeGrant = (grant: ApiGrant): GrantAllocation => {
    const finalPercent = Number(
      grant.finalPercent ??
        grant.finalRatingPercentage ??
        grant.finalRating ??
        0,
    );

    const arccAmountRequested = Number(
      grant.arccAmountRequested ??
        grant.amountRequested ??
        grant.amountFromARCC ??
        0,
    );

    const otherSourcesAmount = Number(
      grant.otherSourcesAmount ??
        grant.otherSources ??
        grant.amountFromOtherSources ??
        0,
    );

    return {
      id: grant.id ?? grant._id ?? crypto.randomUUID(),
      grantTitle: grant.grantTitle ?? grant.title ?? "Untitled Grant",
      submittedBy:
        grant.submittedBy ??
        grant.submittedEmail ??
        grant.proposerName ??
        "Not listed",
      principalInvestigator:
        grant.principalInvestigator ??
        grant.projectDirector ??
        grant.projectDirectorId ??
        "Not listed",
      accountNumber: grant.accountNumber ?? "N/A",
      arccAmountRequested,
      otherSourcesAmount,
      finalPercent,
      allocatedAmount: Number(grant.allocatedAmount ?? 0),
      status: grant.status ?? "Pending Review",
      reviewCount: Number(grant.reviewCount ?? 0),
    };
  };

  const getAwardPercentage = (finalPercent: number) => {
    if (finalPercent < Number(cutoffPercentage)) return 0;

    const rule = criteria.find((item) => {
      const from = Number(item.fromPercentage);
      const to = Number(item.toPercentage);

      if (!Number.isFinite(from) || !Number.isFinite(to)) return false;

      return finalPercent >= from && finalPercent <= to;
    });

    return rule ? Number(rule.awardPercentage) || 0 : 0;
  };

  const calculatedGrants = useMemo(() => {
    return baseGrants.map((grant) => {
      const awardPercentage = getAwardPercentage(grant.finalPercent);
      const allocatedAmount = Math.round(
        grant.arccAmountRequested * (awardPercentage / 100),
      );

      return {
        ...grant,
        allocatedAmount,
        status:
          grant.reviewCount === 0
            ? "Pending Review"
            : allocatedAmount > 0
              ? allocatedAmount >= grant.arccAmountRequested
                ? "Approved (Full)"
                : "Approved (Partial)"
              : "Rejected",
      };
    });
  }, [baseGrants, criteria, cutoffPercentage]);

  const totalAllocated = calculatedGrants.reduce(
    (sum, grant) => sum + grant.allocatedAmount,
    0,
  );

  const totalRequested = calculatedGrants.reduce(
    (sum, grant) => sum + grant.arccAmountRequested,
    0,
  );

  const currentCycle = Number(currentCycleAmount || 0);
  const leftoverAmount = currentCycle - totalAllocated;
  const overAllocated = totalAllocated > currentCycle;
  const shouldDistributeMostFunds = totalRequested >= currentCycle;
  const underDistributed =
    shouldDistributeMostFunds && totalAllocated < currentCycle * 0.95;

  const approvedGrants = calculatedGrants.filter(
    (grant) => grant.allocatedAmount > 0,
  );

  const pendingGrants = calculatedGrants.filter(
    (grant) => grant.status === "Pending Review",
  );

  const rejectedGrants = calculatedGrants.filter(
    (grant) => grant.status === "Rejected",
  );

  const fetchAllocationGrants = async () => {
    if (!token) return;

    setLoading(true);
    setMessage("");

    try {
      const { data } = await axios.get(
        "http://localhost:5000/api/allocation/grants",
        authHeader,
      );

      const apiGrants = Array.isArray(data) ? data : data.grants;

      setBaseGrants(
        Array.isArray(apiGrants) ? apiGrants.map(normalizeGrant) : [],
      );

      if (data.currentCycleAmount !== undefined) {
        setCurrentCycleAmount(String(data.currentCycleAmount));
      }

      if (data.cutoffPercentage !== undefined) {
        setCutoffPercentage(String(data.cutoffPercentage));
      }

      if (Array.isArray(data.criteria)) {
        setCriteria(
          data.criteria.map((item: any) => ({
            fromPercentage: String(item.fromPercentage ?? ""),
            toPercentage: String(item.toPercentage ?? ""),
            awardPercentage: String(item.awardPercentage ?? ""),
          })),
        );
      }

      setAllocationFinalized(Boolean(data.finalized));
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

  const updateCriterion = (
    index: number,
    field: keyof AllocationCriterion,
    value: string,
  ) => {
    if (allocationFinalized) return;

    setCriteria((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );

    setMessage("Allocation criteria updated. Review totals before finalizing.");
  };

  const addCriterion = () => {
    if (allocationFinalized) return;

    setCriteria((current) => [
      ...current,
      { fromPercentage: "", toPercentage: "", awardPercentage: "" },
    ]);
  };

  const removeCriterion = (index: number) => {
    if (allocationFinalized) return;

    setCriteria((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const handleApplyCriterion = () => {
    if (allocationFinalized) return;

    setMessage("Allocation criteria applied. Amounts recalculated.");
  };

  const validateBeforeFinalize = () => {
    if (currentCycle <= 0) {
      setMessage("Current Cycle Amount must be greater than 0.");
      return false;
    }

    if (overAllocated) {
      setMessage("You are allocating more money than available.");
      return false;
    }

    if (underDistributed) {
      setMessage(
        "Warning: Less than 95% of available funds are allocated. Adjust criteria before finalizing.",
      );
      return false;
    }

    return true;
  };

  const handleFinishAllocation = async () => {
    if (!token || allocationFinalized) return;

    if (!validateBeforeFinalize()) return;

    setSaving(true);
    setMessage("");

    try {
      await axios.post(
        "http://localhost:5000/api/allocation/finalize",
        {
          currentCycleAmount: currentCycle,
          leftoverAmount,
          cutoffPercentage: Number(cutoffPercentage),
          criteria: criteria.map((item) => ({
            fromPercentage: Number(item.fromPercentage),
            toPercentage: Number(item.toPercentage),
            awardPercentage: Number(item.awardPercentage),
          })),
          grants: calculatedGrants,
          totalAllocated,
        },
        authHeader,
      );

      setAllocationFinalized(true);
      setMessage("Allocation finalized successfully.");
    } catch (error) {
      console.error("Failed to finalize allocation:", error);
      setMessage("Failed to finalize allocation.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendToAccounting = async () => {
    if (!token) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await axios.post(
        "http://localhost:5000/api/allocation/send-to-accounting",
        {
          currentCycleAmount: currentCycle,
          leftoverAmount,
          cutoffPercentage: Number(cutoffPercentage),
          criteria: criteria.map((item) => ({
            fromPercentage: Number(item.fromPercentage),
            toPercentage: Number(item.toPercentage),
            awardPercentage: Number(item.awardPercentage),
          })),
        },
        {
          ...authHeader,
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "arcc-allocation.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      setMessage("Accounting spreadsheet downloaded successfully.");
    } catch (error) {
      console.error("Failed to export allocation data:", error);
      setMessage("Failed to download accounting spreadsheet.");
    } finally {
      setSaving(false);
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
          <td colSpan={9}>No grants found.</td>
        </tr>
      );
    }

    return grantRows.map((grant) => (
      <tr key={grant.id}>
        <td>{grant.grantTitle}</td>
        <td>{grant.submittedBy}</td>
        <td>{grant.principalInvestigator}</td>
        <td>{grant.accountNumber}</td>
        <td>{formatMoney(grant.arccAmountRequested)}</td>
        <td>{formatMoney(grant.otherSourcesAmount)}</td>
        <td>{grant.finalPercent.toFixed(1)}%</td>
        <td>{formatMoney(grant.allocatedAmount)}</td>
        <td>
          <span className={getStatusClass(grant.status)}>{grant.status}</span>
        </td>
      </tr>
    ));
  };

  return (
    <div className="dashboard-page">
      <DashHeader />

      <main className="allocation-page">
        <div className="allocation-card">
          <div className="allocation-header">
            <div>
              <p className="allocation-eyebrow">ARCC Committee Chair</p>
              <h1>Allocation Page</h1>
              <p className="allocation-subtitle">
                Apply allocation rules, verify funding totals, and export final
                allocation details for accounting.
              </p>
            </div>

            <span className="chair-only-badge">Chair Only</span>
          </div>

          {message && <p className="form-message">{message}</p>}

          {loading && (
            <p className="form-message">Loading allocation data...</p>
          )}

          {allocationFinalized && (
            <div className="allocation-finalized-banner">
              <div>
                <strong>✅ Allocation Finalized</strong>
                <p>
                  This allocation cycle has been finalized and is now locked to
                  protect the official funding decision.
                </p>
                <p>
                  You can still review the results and download the accounting
                  spreadsheet, but allocation values can no longer be changed.
                </p>
              </div>
            </div>
          )}

          <div className="allocation-summary">
            <label className="summary-box">
              <span>Current Cycle Amount</span>
              <input
                type="number"
                min="0"
                value={currentCycleAmount}
                onChange={(e) => setCurrentCycleAmount(e.target.value)}
                disabled={allocationFinalized}
              />
            </label>

            <label className="summary-box">
              <span>Leftover Amount</span>
              <input type="text" value={formatMoney(leftoverAmount)} disabled />
            </label>

            <label className="summary-box">
              <span>Cutoff Percentage</span>
              <input
                type="number"
                min="0"
                max="100"
                value={cutoffPercentage}
                onChange={(e) => setCutoffPercentage(e.target.value)}
                disabled={allocationFinalized}
              />
            </label>
          </div>

          <section className="criteria-card">
            <div className="section-header">
              <div>
                <h2>Allocation Criteria</h2>
                <p>
                  Define score ranges and award percentages. Formula: requested
                  amount × award percentage = allocated amount.
                </p>
              </div>

              {!allocationFinalized && (
                <button type="button" onClick={addCriterion}>
                  Add Criteria
                </button>
              )}
            </div>

            {criteria.map((item, index) => (
              <div className="criteria-row" key={index}>
                <label>
                  <span>From %</span>
                  <input
                    type="number"
                    value={item.fromPercentage}
                    onChange={(e) =>
                      updateCriterion(index, "fromPercentage", e.target.value)
                    }
                    disabled={allocationFinalized}
                  />
                </label>

                <label>
                  <span>To %</span>
                  <input
                    type="number"
                    value={item.toPercentage}
                    onChange={(e) =>
                      updateCriterion(index, "toPercentage", e.target.value)
                    }
                    disabled={allocationFinalized}
                  />
                </label>

                <label>
                  <span>Award %</span>
                  <input
                    type="number"
                    value={item.awardPercentage}
                    onChange={(e) =>
                      updateCriterion(index, "awardPercentage", e.target.value)
                    }
                    disabled={allocationFinalized}
                  />
                </label>

                {!allocationFinalized && (
                  <div className="criteria-actions">
                    <button type="button" onClick={handleApplyCriterion}>
                      Apply
                    </button>

                    <button
                      type="button"
                      onClick={() => removeCriterion(index)}
                      disabled={criteria.length === 1}
                      className="danger-btn"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>

          <div className="allocation-totals">
            <div>
              <span>Total Requested</span>
              <strong>{formatMoney(totalRequested)}</strong>
            </div>

            <div>
              <span>Total Allocated</span>
              <strong>{formatMoney(totalAllocated)}</strong>
            </div>

            <div className={leftoverAmount < 0 ? "danger-total" : ""}>
              <span>Leftover</span>
              <strong>{formatMoney(leftoverAmount)}</strong>
            </div>
          </div>

          {overAllocated && (
            <p className="allocation-warning">
              You are allocating more money than available.
            </p>
          )}

          {underDistributed && !overAllocated && (
            <p className="allocation-warning">
              Less than 95% of available funds are allocated. Please adjust the
              criteria before finalizing.
            </p>
          )}

          <section>
            <h2>Approved Grants</h2>

            <table className="allocation-table">
              <thead>
                <tr>
                  <th>Grant Title</th>
                  <th>Submitted By</th>
                  <th>Principal Investigator</th>
                  <th>Accounting Number</th>
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
            <h2>Pending Review Grants</h2>

            <table className="allocation-table">
              <thead>
                <tr>
                  <th>Grant Title</th>
                  <th>Submitted By</th>
                  <th>Principal Investigator</th>
                  <th>Accounting Number</th>
                  <th>ARCC Requested</th>
                  <th>Other Sources</th>
                  <th>Final Rating</th>
                  <th>Allocated Amount</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>{renderGrantRows(pendingGrants)}</tbody>
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
                  <th>Accounting Number</th>
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
            <button
              type="button"
              onClick={handleFinishAllocation}
              disabled={allocationFinalized || saving}
              className="finish-btn"
            >
              {allocationFinalized
                ? "Allocation Finalized"
                : "Finish Allocation"}
            </button>

            <button
              type="button"
              onClick={handleSendToAccounting}
              disabled={saving}
            >
              Send to Accounting
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
