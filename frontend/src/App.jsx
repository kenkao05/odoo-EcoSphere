import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import WhistleblowerReport from "./pages/WhistleblowerReport.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Environmental from "./pages/Environmental/index.jsx";
import Social from "./pages/Social/index.jsx";
import Governance from "./pages/Governance/index.jsx";
import Gamification from "./pages/Gamification/index.jsx";
import Reports from "./pages/Reports/index.jsx";
import Settings from "./pages/Settings/index.jsx";

function ProtectedRoute({ children }) {
  const { employee, loading } = useAuth();
  if (loading) return null;
  if (!employee) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/whistleblower" element={<WhistleblowerReport />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="environmental" element={<Environmental />} />
        <Route path="social" element={<Social />} />
        <Route path="governance" element={<Governance />} />
        <Route path="gamification" element={<Gamification />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
