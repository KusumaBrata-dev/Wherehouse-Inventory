import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ItemsPage from './pages/ItemsPage';
import ItemDetailPage from './pages/ItemDetailPage';
import ScanPage from './pages/ScanPage';
import TransactionsPage from './pages/TransactionsPage';
import SuppliersPage from './pages/SuppliersPage';
import UsersPage from './pages/UsersPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner dark" style={{ width: 32, height: 32 }} />
      <span>Memuat sistem...</span>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="items"        element={<ItemsPage />} />
          <Route path="items/:id"    element={<ItemDetailPage />} />
          <Route path="scan"         element={<ScanPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="suppliers"    element={<SuppliersPage />} />
          <Route path="users"        element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
