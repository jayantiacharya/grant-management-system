import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import DashHeader from "../components/DashHeader";
import "./Dashboard.css";
import "./ArccCommittee.css";

type ArccUser = {
  id: string;
  email: string;
  department: string;
};

export default function ArccCommittee() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState<ArccUser[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [chairId, setChairId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    const { data } = await axios.get("http://localhost:5000/api/admin/users");

    const mapped = (Array.isArray(data) ? data : [])
      .filter((u) => u?.id && u?.email)
      .map((u) => ({
        id: String(u.id),
        email: String(u.email),
        department: u.department ? String(u.department) : "",
      }));

    setAllUsers(mapped);
  };

  const fetchArcc = async () => {
    const { data } = await axios.get("http://localhost:5000/api/admin/arcc");

    setChairId(data?.chairId ? String(data.chairId) : null);
    setMemberIds(
      Array.isArray(data?.memberIds) ? data.memberIds.map(String) : [],
    );
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }

    fetchUsers();
    fetchArcc();
  }, [user, navigate]);

  const members = memberIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter(Boolean) as ArccUser[];

  const addMember = async (userId: string) => {
    if (memberIds.includes(userId)) return;

    const next = [...memberIds, userId];
    setMemberIds(next);

    await axios.post("http://localhost:5000/api/admin/updateArcc", {
      chairId,
      memberIds: next,
    });
  };

  const removeMember = async (userId: string) => {
    const next = memberIds.filter((id) => id !== userId);
    const nextChair = chairId === userId ? null : chairId;

    setMemberIds(next);
    setChairId(nextChair);

    await axios.post("http://localhost:5000/api/admin/updateArcc", {
      chairId: nextChair,
      memberIds: next,
    });
  };

  const setChair = async (userId: string) => {
    const next = memberIds.includes(userId)
      ? memberIds
      : [...memberIds, userId];

    setChairId(userId);
    setMemberIds(next);

    await axios.post("http://localhost:5000/api/admin/updateArcc", {
      chairId: userId,
      memberIds: next,
    });
  };

  const memberSet = new Set(memberIds);

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "← Back to Admin", to: "/admin" }} />

      <main className="management-main">
        <section className="management-hero">
          <div>
            <p className="admin-eyebrow">Admin Management</p>
            <h1>ARCC Committee</h1>
            <p>Manage committee members and assign chair.</p>
          </div>
        </section>

        {message && <p className="form-message">{message}</p>}

        <section className="management-grid">
          <div className="management-card">
            <div className="management-card-header">
              <span>👥</span>
              <div>
                <h2>Committee Members</h2>
                <p>Current members and chair selection</p>
              </div>
            </div>

            {!members.length ? (
              <p>No members yet.</p>
            ) : (
              <ul className="management-list">
                {members.map((m) => (
                  <li key={m.id} className="management-row">
                    <span>
                      <strong>
                        {chairId === m.id ? "(Chair) " : ""}
                        {m.email}
                      </strong>
                      <small>{m.department || "No department"}</small>
                    </span>

                    <div className="management-actions">
                      <label>
                        <input
                          type="radio"
                          checked={chairId === m.id}
                          onChange={() => setChair(m.id)}
                        />
                        Chair
                      </label>

                      <button
                        onClick={() => removeMember(m.id)}
                        className="edit-btn"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="management-card">
            <div className="management-card-header">
              <span>➕</span>
              <div>
                <h2>All Users</h2>
                <p>Add/remove committee members</p>
              </div>
            </div>

            {!allUsers.length ? (
              <p>No users found.</p>
            ) : (
              <ul className="management-list">
                {allUsers.map((u) => {
                  const isMember = memberSet.has(u.id);

                  return (
                    <li key={u.id} className="management-row">
                      <span>
                        <strong>{u.email}</strong>
                        <small>{u.department || "No department"}</small>
                      </span>

                      <button
                        className="edit-btn"
                        onClick={() =>
                          isMember ? removeMember(u.id) : addMember(u.id)
                        }
                      >
                        {isMember ? "Remove" : "Add"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
