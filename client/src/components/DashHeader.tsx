import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import "../pages/Dashboard.css";

type BackLink = {
  label: string;
  to: string;
};

// Shared page header: brand (links home), optional page-specific buttons
// (children), optional back link, profile via the email button, sign out.
export default function DashHeader({
  back,
  children,
}: {
  back?: BackLink;
  children?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const home = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <header className="dash-header">
      <div
        className="dash-brand"
        onClick={() => navigate(home)}
        style={{ cursor: "pointer" }}
        title="Home"
      >
        <span className="dash-logo">GMS</span>
        <span>Grant Management</span>
      </div>

      <div className="dash-user">
        {children}

        {back && (
          <button onClick={() => navigate(back.to)} className="logout-btn">
            {back.label}
          </button>
        )}

        <button
          onClick={() => navigate("/profile")}
          className="logout-btn"
          title="Profile"
        >
          {user?.email}
        </button>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="logout-btn"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
