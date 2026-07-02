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
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState<ArccUser[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [chairId, setChairId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const fetchUsers = async () => {
    const { data: users } = await axios.get(
      "http://localhost:5000/api/admin/users",
      authHeader,
    );
    const mapped = (Array.isArray(users) ? users : [])
      .filter((u) => u?.id && u?.email)
      .map((u) => ({
        id: String(u.id),
        email: String(u.email),
        department: u.department ? String(u.department) : "",
      }));
    setAllUsers(mapped);
  };

  const fetchArcc = async () => {
    const { data: arcc } = await axios.get(
      "http://localhost:5000/api/admin/arcc",
      authHeader,
    );
    setChairId(arcc?.chairId ? String(arcc.chairId) : null);
    setMemberIds(
      Array.isArray(arcc?.memberIds) ? arcc.memberIds.map(String) : [],
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
    const nextMemberIds = [...memberIds, userId];
    setMemberIds(nextMemberIds);

    try {
      await axios.post(
        "http://localhost:5000/api/admin/updateArcc",
        { chairId, memberIds: nextMemberIds },
        authHeader,
      );
      setMessage("");
    } catch {
      setMessage("Failed to save committee.");
    }
  };

  const removeMember = async (userId: string) => {
    const nextMemberIds = memberIds.filter((id) => id !== userId);
    const nextChairId = chairId === userId ? null : chairId;
    setMemberIds(nextMemberIds);
    setChairId(nextChairId);

    try {
      await axios.post(
        "http://localhost:5000/api/admin/updateArcc",
        { chairId: nextChairId, memberIds: nextMemberIds },
        authHeader,
      );
      setMessage("");
    } catch {
      setMessage("Failed to save committee.");
    }
  };

  const setChair = async (userId: string) => {
    const nextMemberIds = memberIds.includes(userId)
      ? memberIds
      : [...memberIds, userId];
    setChairId(userId);
    setMemberIds(nextMemberIds);

    try {
      await axios.post(
        "http://localhost:5000/api/admin/updateArcc",
        { chairId: userId, memberIds: nextMemberIds },
        authHeader,
      );
      setMessage("");
    } catch {
      setMessage("Failed to save committee.");
    }
  };

  const memberIdSet = new Set(memberIds);

  return (
    <div className="dashboard-page">
      <DashHeader back={{ label: "← Back to Admin Dashboard", to: "/admin" }} />

      <main className="management-main">
        <section className="management-hero">
          <div>
            <p className="admin-eyebrow">Admin Management</p>
            <h1>ARCC Committee</h1>
            <p>
              Manage review committee members and assign the committee chair.
            </p>
          </div>
        </section>

        {message && <p className="form-message">{message}</p>}

        <section className="management-grid">
          <div className="management-card">
            <div className="management-card-header">
              <span className="management-icon">👥</span>
              <div>
                <h2>Committee Members</h2>
                <p>Current ARCC members and chair selection.</p>
              </div>
            </div>

            {!members.length ? (
              <p className="empty-message">No committee members yet.</p>
            ) : (
              <ul className="management-list">
                {members.map((member) => (
                  <li key={member.id} className="management-row">
                    <span>
                      <strong>
                        {chairId === member.id ? "(Chair) " : ""}
                        {member.email}
                      </strong>
                      <small>
                        {member.department || "No department listed"}
                      </small>
                    </span>

                    <div className="management-actions">
                      <label className="chair-label">
                        <input
                          type="radio"
                          name="chair"
                          checked={chairId === member.id}
                          onChange={() => setChair(member.id)}
                        />
                        Chair
                      </label>

                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => removeMember(member.id)}
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
              <span className="management-icon">➕</span>
              <div>
                <h2>All Users</h2>
                <p>Add or remove users from the ARCC committee.</p>
              </div>
            </div>

            {!allUsers.length ? (
              <p className="empty-message">No users found.</p>
            ) : (
              <ul className="management-list">
                {allUsers.map((u) => {
                  const isMember = memberIdSet.has(u.id);

                  return (
                    <li key={u.id} className="management-row">
                      <span>
                        <strong>{u.email}</strong>
                        <small>{u.department || "No department listed"}</small>
                      </span>

                      <button
                        type="button"
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
