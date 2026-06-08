import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import "./ArccCommittee.css";

export default function ArccCommittee() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [chairId, setChairId] = useState(null);
  const [message, setMessage] = useState("");

  const fetchUsers = async () => {
    const { data: users } = await axios.get(
      "http://localhost:5000/api/admin/users",
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
    .filter(Boolean);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const addMember = async (userId) => {
    if (memberIds.includes(userId)) return;
    const nextMemberIds = [...memberIds, userId];
    setMemberIds(nextMemberIds);

    try {
      await axios.post("http://localhost:5000/api/admin/updateArcc", {
        chairId,
        memberIds: nextMemberIds,
      });
      setMessage("");
    } catch {
      setMessage("Failed to save committee.");
    }
  };

  const removeMember = async (userId) => {
    const nextMemberIds = memberIds.filter((id) => id !== userId);
    const nextChairId = chairId === userId ? null : chairId;
    setMemberIds(nextMemberIds);
    setChairId(nextChairId);

    try {
      await axios.post("http://localhost:5000/api/admin/updateArcc", {
        chairId: nextChairId,
        memberIds: nextMemberIds,
      });
      setMessage("");
    } catch {
      setMessage("Failed to save committee.");
    }
  };

  const setChair = async (userId) => {
    const nextMemberIds = memberIds.includes(userId)
      ? memberIds
      : [...memberIds, userId];
    setChairId(userId);
    setMemberIds(nextMemberIds);

    try {
      await axios.post("http://localhost:5000/api/admin/updateArcc", {
        chairId: userId,
        memberIds: nextMemberIds,
      });
      setMessage("");
    } catch {
      setMessage("Failed to save committee.");
    }
  };

  const memberIdSet = new Set(memberIds);

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>
        <div className="dash-user">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">
            Sign out
          </button>
        </div>
      </header>
      <main className="dash-main">
        <div className="dash-welcome">
          <h2>ARCC Committee</h2>
          <p>Manage review committee members and chair</p>
          <button
            type="button"
            className="edit-btn"
            onClick={() => navigate("/admin")}
          >
            Back to Admin
          </button>
        </div>
        {message && <p className="form-message">{message}</p>}
        <div className="arcc-grid">
          <div className="grant-form-card">
            <h2>Committee Members</h2>
            {!members.length ? (
              <p>No committee members yet.</p>
            ) : (
              <ul className="list">
                {members.map((member) => (
                  <li key={member.id} className="row">
                    <span>
                      {chairId === member.id ? "(Chair) " : ""}
                      {member.email}{" "}
                      {member.department ? `- ${member.department}` : ""}
                    </span>
                    <div className="actions">
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

          <div className="grant-form-card">
            <h2>All Users</h2>
            {!allUsers.length ? (
              <p>No users found.</p>
            ) : (
              <ul className="list">
                {allUsers.map((u) => {
                  const isMember = memberIdSet.has(u.id);
                  return (
                    <li key={u.id} className="row">
                      <span>
                        {u.email} {u.department ? `- ${u.department}` : ""}
                      </span>
                      <div className="actions">
                        {isMember ? (
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => removeMember(u.id)}
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => addMember(u.id)}
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
