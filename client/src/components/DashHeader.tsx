import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isDeanOnly } from "../utils/roles";

import "../pages/Dashboard.css";

type BackLink = {
  label: string;
  to: string;
};

// Shared page header: brand (links home), role-based nav (link to the current
// page is disabled), optional page-specific buttons (children), optional back
// link, profile via the email button, sign out.
export default function DashHeader({
  back,
  children,
}: {
  back?: BackLink;
  children?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const home = user?.role === "admin" ? "/admin" : "/dashboard";

  // Dean-only users skip the Dashboard link: their dashboard redirects to
  // College Grants. The link set stays stable across pages; the current
  // page's link is disabled rather than hidden.
  const navLinks = [
    { label: "Dashboard", to: "/dashboard", show: !isDeanOnly(user) },
    { label: "Review", to: "/review", show: !!user?.isArcc },
    {
      label: "Dept Review",
      to: "/department-review",
      show: !!user?.isDeptChair,
    },
    { label: "College Grants", to: "/college-grants", show: !!user?.isDean },
    { label: "Admin", to: "/admin", show: user?.role === "admin" },
  ].filter((link) => link.show);

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
        {navLinks.map((link) => (
          <button
            key={link.to}
            onClick={() => navigate(link.to)}
            className="logout-btn"
            disabled={link.to === pathname}
          >
            {link.label}
          </button>
        ))}

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
