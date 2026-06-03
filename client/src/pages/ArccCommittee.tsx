import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import "./ArccCommittee.css";

export default function ArccCommittee() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }

    axios
      .get("http://localhost:5000/api/admin/users")
      .then((res) => {
        const users = Array.isArray(res.data) ? res.data : [];
        const allUsers = users
          .filter((u) => u?.id && u?.email)
          .map((u) => ({
            id: String(u.id),
            email: String(u.email),
            department: u.department ? String(u.department) : "",
          }));

        // set the first 2 users for mock data
        const initialMembers = allUsers.slice(0, Math.min(2, allUsers.length));
        const chairId = initialMembers[0]?.id ?? null;

        setData({
          chairId,
          members: initialMembers,
          allUsers,
        });
        setMessage("");
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setMessage("Failed to load ARCC committee data.");
        setData({
          chairId: null,
          members: [],
          allUsers: [],
        });
      });
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const addMember = (userId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      if (prev.members.some((m) => m.id === userId)) return prev;
      const newUser = prev.allUsers.find((u) => u.id === userId);
      if (!newUser) return prev;
      return { ...prev, members: [...prev.members, newUser] };
    });
    setMessage("");
  };

  const removeMember = (userId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const nextMembers = prev.members.filter((m) => m.id !== userId);
      return {
        ...prev,
        members: nextMembers,
        chairId: prev.chairId === userId ? null : prev.chairId,
      };
    });
    setMessage("");
  };

  const setChair = (userId: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const isMember = prev.members.some((m) => m.id === userId);
      const userToAdd = prev.allUsers.find((u) => u.id === userId);
      const nextMembers =
        !isMember && userToAdd ? [...prev.members, userToAdd] : prev.members;
      return { ...prev, chairId: userId, members: nextMembers };
    });
    setMessage("");
  };

  const memberIds = new Set(data?.members.map((m) => m.id) ?? []);

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
            {!data?.members.length ? (
              <p>No committee members yet.</p>
            ) : (
              <ul className="list">
                {data.members.map((member) => (
                  <li key={member.id} className="row">
                    <span>
                      {data.chairId === member.id ? "(Chair) " : ""}
                      {member.email}{" "}
                      {member.department ? `- ${member.department}` : ""}
                    </span>
                    <div className="actions">
                      <label className="chair-label">
                        <input
                          type="radio"
                          name="chair"
                          checked={data.chairId === member.id}
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
            {!data?.allUsers.length ? (
              <p>No users found.</p>
            ) : (
              <ul className="list">
                {data.allUsers.map((u) => {
                  const isMember = memberIds.has(u.id);
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
