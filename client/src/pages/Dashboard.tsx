import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-page">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="dash-logo">GMS</span>
          <span>Grant Management</span>
        </div>
        <div className="dash-user">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">Sign out</button>
        </div>
      </header>
      <main className="dash-main">
        <div className="dash-welcome">
          <h2>Welcome back</h2>
          <p>Weber State University — Grant Management System</p>
        </div>
        <div className="dash-grid">
          <button className="dash-card" disabled>
            <div className="dash-card-icon">🏛️</div>
            <div className="dash-card-body">
              <h3>Colleges</h3>
              <p>Manage colleges and assign deans</p>
            </div>
            <span className="dash-card-badge">Coming soon</span>
          </button>
          <button className="dash-card" disabled>
            <div className="dash-card-icon">🏢</div>
            <div className="dash-card-body">
              <h3>Departments</h3>
              <p>Manage departments and assign chairs</p>
            </div>
            <span className="dash-card-badge">Coming soon</span>
          </button>
        </div>
      </main>
    </div>
  );
}
