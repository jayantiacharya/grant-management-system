import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashHeader from "../components/DashHeader";
import { useAuth } from "../context/AuthContext";
import "../styles/PageLayout.css";
import "../styles/DonorReport.css";

type DonorGrant = {
  _id: string;
  title: string;
  submittedEmail: string;
  college: string;
  department: string;
  allocatedAmount: number;
};

type Tab = "overview" | "grants";

const AMOUNT_BUCKETS = [
  { label: "$0 - $2,000", min: 0, max: 2000 },
  { label: "$2,000 - $5,000", min: 2000, max: 5000 },
  { label: "$5,000 - $10,000", min: 5000, max: 10000 },
  { label: "$10,000+", min: 10000, max: Infinity },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

function sumByKey(grants: DonorGrant[], key: "college" | "department") {
  const totals = new Map<string, number>();

  for (const grant of grants) {
    const label = grant[key] || "Unknown";
    totals.set(label, (totals.get(label) ?? 0) + grant.allocatedAmount);
  }

  return Array.from(totals.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

function bucketCounts(grants: DonorGrant[]) {
  return AMOUNT_BUCKETS.map((bucket) => ({
    name: bucket.label,
    count: grants.filter(
      (grant) =>
        grant.allocatedAmount >= bucket.min &&
        grant.allocatedAmount < bucket.max,
    ).length,
  }));
}

export default function DonorReport() {
  const { token } = useAuth();
  const [grants, setGrants] = useState<DonorGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const [collegeFilter, setCollegeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  useEffect(() => {
    const fetchReport = async () => {
      if (!token) return;

      setLoading(true);
      setError("");

      try {
        const { data } = await axios.get(
          "http://localhost:5000/api/donor-report/grants",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setGrants(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load donor report");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token]);

  const collegeTotals = useMemo(() => sumByKey(grants, "college"), [grants]);
  const departmentTotals = useMemo(
    () => sumByKey(grants, "department"),
    [grants],
  );
  const buckets = useMemo(() => bucketCounts(grants), [grants]);

  const topFive = useMemo(
    () =>
      [...grants]
        .sort((a, b) => b.allocatedAmount - a.allocatedAmount)
        .slice(0, 5),
    [grants],
  );

  const collegeOptions = useMemo(
    () => Array.from(new Set(grants.map((g) => g.college))).sort(),
    [grants],
  );

  const departmentOptions = useMemo(() => {
    const pool = collegeFilter
      ? grants.filter((g) => g.college === collegeFilter)
      : grants;
    return Array.from(new Set(pool.map((g) => g.department))).sort();
  }, [grants, collegeFilter]);

  const filteredGrants = useMemo(() => {
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;

    return grants.filter((grant) => {
      if (collegeFilter && grant.college !== collegeFilter) return false;
      if (departmentFilter && grant.department !== departmentFilter) {
        return false;
      }
      if (min !== null && !Number.isNaN(min) && grant.allocatedAmount < min) {
        return false;
      }
      if (max !== null && !Number.isNaN(max) && grant.allocatedAmount > max) {
        return false;
      }
      return true;
    });
  }, [grants, collegeFilter, departmentFilter, minAmount, maxAmount]);

  const totalAllocated = useMemo(
    () => grants.reduce((sum, g) => sum + g.allocatedAmount, 0),
    [grants],
  );

  return (
    <div className="dashboard-page">
      <DashHeader />

      <main className="dr-main">
        <div className="dr-card">
          <h1 className="dr-title">Donor Report</h1>
          <p className="dr-subtitle">
            An overview of how allocated grant funds have been spent, for use
            when reporting back to donors and funding sources.
          </p>

          {loading && <p className="dr-status">Loading report...</p>}
          {error && <p className="dr-status dr-error">{error}</p>}

          {!loading && !error && (
            <>
              <div className="dr-tabs">
                <button
                  type="button"
                  className={`dr-tab ${tab === "overview" ? "dr-tab-active" : ""}`}
                  onClick={() => setTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`dr-tab ${tab === "grants" ? "dr-tab-active" : ""}`}
                  onClick={() => setTab("grants")}
                >
                  Grants
                </button>
              </div>

              {tab === "overview" && (
                <div className="dr-overview">
                  <p className="dr-total-line">
                    Total allocated across {grants.length} funded grant
                    {grants.length === 1 ? "" : "s"}:{" "}
                    <strong>{formatCurrency(totalAllocated)}</strong>
                  </p>

                  <section className="dr-chart-section">
                    <h2>Amount Received by College</h2>
                    {collegeTotals.length === 0 ? (
                      <p className="dr-empty">No funded grants yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={collegeTotals}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                          />
                          <Bar dataKey="total" fill="#1a56db" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </section>

                  <section className="dr-chart-section">
                    <h2>Amount Received by Department</h2>
                    {departmentTotals.length === 0 ? (
                      <p className="dr-empty">No funded grants yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={departmentTotals}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            angle={-20}
                            textAnchor="end"
                            height={70}
                            interval={0}
                          />
                          <YAxis
                            tickFormatter={(value) => formatCurrency(value)}
                          />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                          />
                          <Bar dataKey="total" fill="#0e9f6e" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </section>

                  <section className="dr-chart-section">
                    <h2>Grants by Amount Range</h2>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={buckets}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>

                  <section className="dr-chart-section">
                    <h2>Top 5 Grants by Amount</h2>
                    {topFive.length === 0 ? (
                      <p className="dr-empty">No funded grants yet.</p>
                    ) : (
                      <ol className="dr-top-list">
                        {topFive.map((grant) => (
                          <li key={grant._id} className="dr-top-item">
                            <span className="dr-top-title">{grant.title}</span>
                            <span className="dr-top-meta">
                              {grant.college} — {grant.department}
                            </span>
                            <span className="dr-top-amount">
                              {formatCurrency(grant.allocatedAmount)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              )}

              {tab === "grants" && (
                <div className="dr-grants">
                  <div className="dr-filters">
                    <label>
                      <span>College</span>
                      <select
                        value={collegeFilter}
                        onChange={(e) => {
                          setCollegeFilter(e.target.value);
                          setDepartmentFilter("");
                        }}
                      >
                        <option value="">All colleges</option>
                        {collegeOptions.map((college) => (
                          <option key={college} value={college}>
                            {college}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Department</span>
                      <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                      >
                        <option value="">All departments</option>
                        {departmentOptions.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Min Amount</span>
                      <input
                        type="number"
                        min="0"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        placeholder="0"
                      />
                    </label>

                    <label>
                      <span>Max Amount</span>
                      <input
                        type="number"
                        min="0"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        placeholder="No max"
                      />
                    </label>

                    <button
                      type="button"
                      className="dr-clear-btn"
                      onClick={() => {
                        setCollegeFilter("");
                        setDepartmentFilter("");
                        setMinAmount("");
                        setMaxAmount("");
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>

                  <p className="dr-result-count">
                    Showing {filteredGrants.length} of {grants.length} funded
                    grants
                  </p>

                  {filteredGrants.length === 0 ? (
                    <p className="dr-empty">
                      No grants match the current filters.
                    </p>
                  ) : (
                    <table className="dr-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>College</th>
                          <th>Department</th>
                          <th>Submitted By</th>
                          <th>Allocated Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGrants.map((grant) => (
                          <tr key={grant._id}>
                            <td>{grant.title}</td>
                            <td>{grant.college}</td>
                            <td>{grant.department}</td>
                            <td>{grant.submittedEmail}</td>
                            <td>{formatCurrency(grant.allocatedAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
